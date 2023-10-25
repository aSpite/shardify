import {
    Blockchain,
    internal,
    SandboxContract,
    SmartContractSnapshot,
    TreasuryContract
} from '@ton-community/sandbox';
import {Address, beginCell, Cell, toNano} from 'ton-core';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {KeyPair, mnemonicToWalletKey, sign} from "ton-crypto";
import {bufferToBigInt, getFracBody, signFracBody} from "./helper";
import {NftItem} from "../wrappers/NftItem";
import {OPCODES} from "../config";
import {NftHolder} from "../wrappers/NftHolder";
import {JettonWallet} from "../wrappers/JettonWallet";
import {PoolMaster} from "../wrappers/PoolMaster";
import {printTransactionFees} from "./utils";

describe('Fractionalization', () => {
    let blockchain: Blockchain
    // ----- Treasury -----
    let admin: SandboxContract<TreasuryContract>;
    let poolCreator: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let nftOwner: SandboxContract<TreasuryContract>

    // ----- Contracts -----
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let nftHolder: SandboxContract<NftHolder>;
    let nft: SandboxContract<NftItem>;
    let poolMaster: SandboxContract<PoolMaster>;

    // ----- Snapshots -----
    let nftBeforeSent: SmartContractSnapshot;
    let nftAfterSent: SmartContractSnapshot;

    // ----- Constants -----
    const collectionAddress = Address.parse('EQAVGhk_3rUA3ypZAZ1SkVGZIaDt7UdvwA4jsSGRKRo-MRDN');
    const nftAddress = Address.parse('EQA3tiXRxGrbobJiBEDMgl7Lp47uCBb4cG4PPSB72LI6MbOc');
    const defaultContent = beginCell().storeUint(333, 32).endCell();

    // ----- Codes -----
    let nftHolderCode: Cell;
    let jettonWalletCode: Cell;
    let jettonMinterCode: Cell;

    // ----- Others -----
    let keyPair: KeyPair;
    let keyPair2: KeyPair;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        nftHolderCode = await compile('NftHolder')
        jettonWalletCode = await compile('JettonWallet');
        jettonMinterCode = await compile('JettonMinter');

        admin = await blockchain.treasury('admin');
        poolCreator = await blockchain.treasury('pool creator');
        user = await blockchain.treasury('user');
        nftOwner = await blockchain.treasury('nft owner');
        keyPair = await mnemonicToWalletKey('harbor lobster spin vessel lamp text check magic stone element abstract guide citizen praise tube reject patch what stuff space fork radio symbol brother'.split(' '));
        keyPair2 = await mnemonicToWalletKey('teach crew goat trouble gentle yellow solution iron broken task kiwi stay ladder flame merry actual home connect episode try protect salmon machine cushion'.split(' '));

        poolMaster = blockchain.openContract(PoolMaster.createFromConfig({
            adminAddress: admin.address,
            publicKey: keyPair.publicKey
        }, await compile('PoolMaster')));
        const deployResult = await poolMaster.sendDeploy(admin.getSender(), toNano(1));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: poolMaster.address,
            deploy: true,
            success: true
        });

        jettonMinter = blockchain.openContract(JettonMinter.createFromConfig({
                admin: poolMaster.address,
                content: defaultContent,
                wallet_code: jettonWalletCode,
                fracData: {
                    partsCount: 50n,
                    nftHolderCode: nftHolderCode,
                    publicKey: bufferToBigInt(keyPair.publicKey),
                    collectionAddress: collectionAddress,
                    creatorAddress: poolCreator.address
                }
            }, jettonMinterCode)
        );
        nft = blockchain.openContract(NftItem.createFromConfig({
            index: 0,
            collectionAddress: collectionAddress
        }, await compile('NftItem')));
        const nftDeployResult = await blockchain.sendMessage(internal({
            from: collectionAddress,
            to: nft.address,
            value: toNano('0.1'),
            stateInit: {
                code: await compile('NftItem'),
                data: beginCell().storeUint(0, 64).storeAddress(collectionAddress).endCell()
            },
            body: beginCell().storeAddress(nftOwner.address).storeRef(defaultContent).endCell()
        }));
        nftBeforeSent = (await blockchain.getContract(nft.address)).snapshot();
        expect(nftDeployResult.transactions).toHaveTransaction({
            from: collectionAddress,
            to: nft.address,
            deploy: true,
            success: true
        });


        // let deployResult = await jettonMinter.sendDeploy(poolCreator.getSender(), toNano(1));
        // expect(deployResult.transactions).toHaveTransaction({
        //     from: poolCreator.address,
        //     to: jettonMinter.address,
        //     deploy: true,
        //     success: true
        // });
        // let data = await jettonMinter.getJettonData();
        // expect(data.content.hash().toString('hex')).toStrictEqual(defaultContent.hash().toString('hex'));
        // expect((await jettonMinter.getWalletAddress(user.address)).toString())
        //     .toStrictEqual(getJettonWallet(user.address, jettonMinter.address, jettonWalletCode, 50n, nftHolderCode).toString());

        nftHolder = blockchain.openContract(NftHolder.createFromConfig({
            jettonMasterAddress: jettonMinter.address,
            nftAddress: nft.address
        }, nftHolderCode));

        jettonWallet = blockchain.openContract(JettonWallet.createFromConfig({
            balance: 0n,
            ownerAddress: nftOwner.address,
            jettonMasterAddress: jettonMinter.address,
            jettonWalletCode: jettonWalletCode,
            partsCount: 50n,
            holderCode: nftHolderCode
        }, jettonWalletCode));

        console.log(`Nft address: ${nft.address.toString()}
Nft holder address: ${nftHolder.address.toString()}
Jetton minter address: ${jettonMinter.address.toString()}
Jetton wallet address: ${jettonWallet.address.toString()}
Nft owner address: ${nftOwner.address.toString()}
Admin address: ${admin.address.toString()}
Pool creator address: ${poolCreator.address.toString()}
User address: ${user.address.toString()}
Collection address: ${collectionAddress.toString()}
Pool master address: ${poolMaster.address.toString()}`);
    });

    // beforeEach(async () => {
    //
    // });

    it('creating pool', async () => {
        const fracData = beginCell()
            .storeCoins(50n)
            .storeRef(nftHolderCode)
            .storeUint(bufferToBigInt(keyPair.publicKey), 256)
            .storeAddress(collectionAddress)
            .storeAddress(poolCreator.address)
            .endCell();
        const payload = beginCell()
            .storeCoins(toNano(10))
            .storeRef(defaultContent)
            .storeRef(jettonWalletCode)
            .storeRef(fracData)
            .endCell();
        const signature = sign(payload.hash(), keyPair.secretKey);
        const result = await poolMaster.sendCreatePool(poolCreator.getSender(),
            toNano(12), 0n, signature, payload, jettonMinterCode);
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: jettonMinter.address,
            deploy: true,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: poolCreator.address,
            success: true
        });

        const minterData = await jettonMinter.getFracData();
        expect(minterData.partsCount).toStrictEqual(50n);
        expect(minterData.nftHolderCode.hash().toString('hex')).toStrictEqual(nftHolderCode.hash().toString('hex'));
        expect(minterData.publicKey).toStrictEqual(bufferToBigInt(keyPair.publicKey));
        expect(minterData.collectionAddress.toString()).toStrictEqual(collectionAddress.toString());
        expect(minterData.creatorAddress.toString()).toStrictEqual(poolCreator.address.toString());
        printTransactionFees(result.transactions, 'creating pool');
    });

    it('fractionalization', async () => {
        const valid_until = Math.ceil(Date.now() / 1000) + 120; // 2 minutes
        const price = toNano(20);
        const creatorFeeNumerator = 5;
        const fracBody = getFracBody(valid_until, 0, nft.init?.code!, price, creatorFeeNumerator);
        const forwardPayload = beginCell()
            .storeBuffer(signFracBody(fracBody, keyPair.secretKey))
            .storeRef(fracBody)
            .endCell();

        let result = await nft.sendTransfer(nftOwner.getSender(), toNano(30), 3, jettonMinter.address,
            nftOwner.address, toNano(28), forwardPayload);
        nftAfterSent = (await blockchain.getContract(nft.address)).snapshot();
        printTransactionFees(result.transactions, 'fractionalization');
        expect(result.transactions).toHaveTransaction({
            from: nft.address,
            to: jettonMinter.address,
            op: OPCODES.NFT_OWNERSHIP_ASSIGNED,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: poolCreator.address,
            success: true,
            value: toNano(1)
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: poolMaster.address,
            success: true,
            value: toNano(19)
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: nftHolder.address,
            deploy: true,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: nft.address,
            success: true,
            op: OPCODES.NFT_TRANSFER,
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: jettonWallet.address,
            deploy: true,
            success: true,
            op: OPCODES.JETTON_INTERNAL_TRANSFER,
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: nftOwner.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.NFT_OWNERSHIP_ASSIGNED
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: nftOwner.address,
            success: true,
            op: OPCODES.EXCESSES
        });

        const walletData = await jettonWallet.getWalletData();
        expect(walletData.balance).toStrictEqual(50n);
        const holderData = await nftHolder.getHolderData();
        expect(holderData.ownNft).toBeTruthy();
        expect(holderData.partsCount).toStrictEqual(50n);
        expect(holderData.nftAddress.toString()).toStrictEqual(nft.address.toString());
        expect(holderData.jettonMasterAddress.toString()).toStrictEqual(jettonMinter.address.toString());
        expect(await jettonMinter.getTotalSupply()).toStrictEqual(50n);
    });

    it('handle fail when defrac', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftBeforeSent);
        let result = await jettonWallet.sendReturnNft(nftOwner.getSender(), toNano(2), 4n, nft.address);
        printTransactionFees(result.transactions, 'handle fail when defrac')
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.HOLDER_RETURN
        });
        expect(result.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: nft.address,
            success: false,
            exitCode: 401
        });
        expect(result.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            inMessageBounced: true,
            outMessagesCount: 1
        });
        expect(result.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: jettonWallet.address,
            success: true,
            op: OPCODES.HOLDER_RETURN_FAIL
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: nftOwner.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: nftOwner.address,
            success: true,
            op: OPCODES.HOLDER_RETURN_FAIL
        });
        const holderData = await nftHolder.getHolderData();
        expect(holderData.lastTakerAddress).toBeNull();
        expect(holderData.ownNft).toBeTruthy();
        expect(await jettonWallet.getJettonBalance()).toStrictEqual(50n);
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
    });

    it('defractionalization', async () => {
        let result = await jettonWallet.sendReturnNft(nftOwner.getSender(), toNano(1), 4n, nft.address);
        printTransactionFees(result.transactions, 'defractionalization')
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.HOLDER_RETURN
        });
        expect(result.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: nft.address,
            success: true,
            op: OPCODES.NFT_TRANSFER
        });
        expect(result.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.EXCESSES
        });
        expect(result.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: jettonMinter.address,
            success: true,
            op: OPCODES.JETTON_BURN_NOTIFICATION
        });
        expect(result.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: nftOwner.address,
            success: true,
        });
        expect((await nft.getNftData()).owner!.toString()).toStrictEqual(nftOwner.address.toString());
        expect((await jettonWallet.getWalletData()).balance).toStrictEqual(0n);
        expect((await jettonMinter.getTotalSupply())).toStrictEqual(0n);
        const holderData = await nftHolder.getHolderData();
        expect(holderData.ownNft).toBeFalsy();
        expect(holderData.lastTakerAddress).toBeNull();
    });

    it('should change admin address by admin address', async () => {
        const result = await poolMaster.sendChangeAdminAddr(
            admin.getSender(), toNano(1), 0n, poolCreator.address
        );
        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: poolMaster.address,
            success: true
        });
        const data = await poolMaster.getAdminData();
        expect(data.adminAddress.toString()).toStrictEqual(poolCreator.address.toString());
    });

    it('should change admin address by signature', async () => {
        const newAddr = beginCell()
            .storeUint(Math.floor(Date.now() / 1000) + 60, 32)
            .storeAddress(admin.address)
            .endCell();
        const signature = sign(newAddr.hash(), keyPair.secretKey);
        const result = await poolMaster.sendChangeAdminSign(poolCreator.getSender(),
            toNano(1), 0n, signature, newAddr
        );
        expect(result.transactions).toHaveTransaction({
            from: poolCreator.address,
            to: poolMaster.address,
            success: true
        });
        const data = await poolMaster.getAdminData();
        expect(data.adminAddress.toString()).toStrictEqual(admin.address.toString());
    });

    it('should change minter public key', async () => {
        await jettonMinter.getFracData();
        const result = await poolMaster.sendChangeMinterPubKey(admin.getSender(),
            toNano(1),
            0n,
            jettonMinter.address,
            keyPair2.publicKey
        );
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: jettonMinter.address,
            success: true
        });
        // printTransactionFees(result.transactions)
        const data = await jettonMinter.getFracData();
        expect(data.publicKey).toStrictEqual(bufferToBigInt(keyPair2.publicKey));
    });

    it('should withdraw nft', async () => {
       await nft.sendTransfer(nftOwner.getSender(), toNano('0.05'), 0, jettonMinter.address, nftOwner.address, 0n);
       let data = await nft.getNftData();
       expect(data.owner!.toString()).toStrictEqual(jettonMinter.address.toString());
       const result = await poolMaster.sendMinterWithdrawNft(admin.getSender(),
              toNano(1), 0n, jettonMinter.address, nft.address, nftOwner.address);
       expect(result.transactions).toHaveTransaction({
          from: nft.address,
          to: nftOwner.address,
          success: true,
          op: OPCODES.EXCESSES
       });
       data = await nft.getNftData();
       expect(data.owner!.toString()).toStrictEqual(nftOwner.address.toString());
    });

    it('should change minter content', async () => {
        const newContent = beginCell().storeUint(444, 32).endCell();
        const result = await poolMaster.sendChangeMinterContent(admin.getSender(),
            toNano(1), 0n, jettonMinter.address, newContent
        );
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: jettonMinter.address,
            success: true
        });
        expect((await jettonMinter.getContent()).hash().toString('hex')).toStrictEqual(newContent.hash().toString('hex'));
    });

    it('should change minter admin', async () => {
        const result = await poolMaster.sendChangeMinterAdmin(admin.getSender(),
            toNano(1), 0n, jettonMinter.address, user.address
        );
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: jettonMinter.address,
            success: true
        });
        expect((await jettonMinter.getAdminAddress()).toString()).toStrictEqual(user.address.toString());

        await jettonMinter.sendChangeAdmin(user.getSender(), admin.address);
        expect((await jettonMinter.getAdminAddress()).toString()).toStrictEqual(admin.address.toString());
    });

    it('should withdraw ton', async () => {
        const result = await poolMaster.sendWithdrawTon(admin.getSender(),
            toNano(1), 0n
        );
        expect(result.transactions).toHaveTransaction({
            from: poolMaster.address,
            to: admin.address,
            success: true
        });
        expect((await blockchain.getContract(poolMaster.address)).balance).toStrictEqual(10_000_000n);
    });
});
