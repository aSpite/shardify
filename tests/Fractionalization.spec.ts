import {
    Blockchain,
    internal,
    printTransactionFees,
    SandboxContract,
    SmartContractSnapshot,
    TreasuryContract
} from '@ton-community/sandbox';
import {Address, beginCell, toNano} from 'ton-core';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {KeyPair, mnemonicToWalletKey} from "ton-crypto";
import {bufferToBigInt, getFracBody, getJettonWallet, signFracBody} from "./helper";
import {NftItem} from "../wrappers/NftItem";
import {OPCODES} from "../config";
import {NftHolder} from "../wrappers/NftHolder";
import {JettonWallet} from "../wrappers/JettonWallet";

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

    // ----- Snapshots -----
    let nftBeforeSent: SmartContractSnapshot;
    let nftAfterSent: SmartContractSnapshot;

    // ----- Constants -----
    const collectionAddress = Address.parse('EQAVGhk_3rUA3ypZAZ1SkVGZIaDt7UdvwA4jsSGRKRo-MRDN');
    const nftAddress = Address.parse('EQA3tiXRxGrbobJiBEDMgl7Lp47uCBb4cG4PPSB72LI6MbOc');
    const defaultContent = beginCell().storeUint(333, 32).endCell();

    // ----- Others -----
    let keyPair: KeyPair;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        const nftHolderCode = await compile('NftHolder')
        const jettonWalletCode = await compile('JettonWallet');

        admin = await blockchain.treasury('admin');
        poolCreator = await blockchain.treasury('pool creator');
        user = await blockchain.treasury('user');
        nftOwner = await blockchain.treasury('nft owner');
        keyPair = await mnemonicToWalletKey('harbor lobster spin vessel lamp text check magic stone element abstract guide citizen praise tube reject patch what stuff space fork radio symbol brother'.split(' '));

        jettonMinter = blockchain.openContract(JettonMinter.createFromConfig({
                admin: admin.address,
                content: defaultContent,
                wallet_code: jettonWalletCode,
                fracData: {
                    partsCount: 50n,
                    nftHolderCode: nftHolderCode,
                    publicKey: bufferToBigInt(keyPair.publicKey),
                    collectionAddress: collectionAddress,
                    creatorAddress: poolCreator.address
                }
            }, await compile('JettonMinter'))
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


        let deployResult = await jettonMinter.sendDeploy(admin.getSender(), toNano(1));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: jettonMinter.address,
            deploy: true,
            success: true
        });
        let data = await jettonMinter.getJettonData();
        expect(data.content.hash().toString('hex')).toStrictEqual(defaultContent.hash().toString('hex'));
        expect((await jettonMinter.getWalletAddress(user.address)).toString())
            .toStrictEqual(getJettonWallet(user.address, jettonMinter.address, jettonWalletCode, 50n, nftHolderCode).toString());

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
    });

    // beforeEach(async () => {
    //
    // });

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
        printTransactionFees(result.transactions)
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
            to: admin.address,
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
        printTransactionFees(result.transactions)
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
        printTransactionFees(result.transactions)
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
});
