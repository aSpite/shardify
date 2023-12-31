import {
    Blockchain,
    internal,
    SandboxContract,
    SmartContractSnapshot,
    TreasuryContract
} from '@ton-community/sandbox';
import {Address, beginCell, Cell, toNano} from 'ton-core';
import { NftHolder } from '../wrappers/NftHolder';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {NftItem} from "../wrappers/NftItem";
import {ERRORS, OPCODES} from "../config";
import {getJettonWallet} from "./helper";

describe('NftHolder', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let nftHolder: SandboxContract<NftHolder>;
    let jettonWalletCode: Cell;
    let deployer: SandboxContract<TreasuryContract>;
    let masterTreasury: SandboxContract<TreasuryContract>; // simulate jetton master
    let deployerJettonWallet: Address; // jetton wallet address for deployer
    let nft: SandboxContract<NftItem>
    let nftBeforeSent: SmartContractSnapshot;
    let nftAfterSent: SmartContractSnapshot;
    let holderAfterSent: SmartContractSnapshot;

    beforeAll(async () => {
        code = await compile('NftHolder');
        blockchain = await Blockchain.create();
        jettonWalletCode   = await compile('JettonWallet');
        deployer       = await blockchain.treasury('deployer');
        nft = blockchain.openContract(NftItem.createFromConfig({
            index: 0,
            collectionAddress: deployer.address
        }, await compile('NftItem')));
        masterTreasury = await blockchain.treasury('jettonMaster');
        const defaultContent = beginCell().endCell();

        nftHolder = blockchain.openContract(NftHolder.createFromConfig({
            jettonMasterAddress: masterTreasury.address, // treasury address for tests
            nftAddress: nft.address
        }, code));

        const holderDeployResult = await nftHolder.sendDeploy(
            masterTreasury.getSender(), toNano('0.05'), 50n, jettonWalletCode, code, masterTreasury.address
        );

        expect(holderDeployResult.transactions).toHaveTransaction({
            from: masterTreasury.address,
            to: nftHolder.address,
            deploy: true,
            success: true,
        });

        const nftDeployResult = await nft.sendDeploy(
            deployer.getSender(), toNano('0.05'), deployer.address, defaultContent
        );
        expect(nftDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nft.address,
            deploy: true,
            success: true
        });
        nftBeforeSent = (await blockchain.getContract(nft.address)).snapshot();
        const holderBeforeSent = (await blockchain.getContract(nftHolder.address)).snapshot();
        await nft.sendTransfer(
            deployer.getSender(), toNano('0.05'), 0, nftHolder.address,
            nftHolder.address, toNano(0.01), beginCell().storeAddress(deployer.address).endCell()
        );
        holderAfterSent = (await blockchain.getContract(nftHolder.address)).snapshot();
        deployerJettonWallet = getJettonWallet(
            deployer.address,
            masterTreasury.address,
            jettonWalletCode,
            50n,
            code
        );
        nftAfterSent = (await blockchain.getContract(nft.address)).snapshot();
        expect((await nft.getNftData()).owner!.toString()).toStrictEqual(nftHolder.address.toString());
        (await blockchain.getContract(nft.address)).loadFrom(nftBeforeSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderBeforeSent);
        console.log(`NFT Holder address: ${nftHolder.address.toString()}
NFT address: ${nft.address.toString()}
Deployer address: ${deployer.address.toString()}
Master treasury address: ${masterTreasury.address.toString()}
Deployer jetton wallet address: ${deployerJettonWallet.toString()}`);
    });

    it('should deploy', async () => {
        const result = await nftHolder.getHolderData();
        expect(result.jettonMasterAddress.toString()).toStrictEqual(masterTreasury.address.toString());
        expect(result.nftAddress.toString()).toStrictEqual(nft.address.toString());
        expect(result.lastTakerAddress).toBeNull();
        expect(result.partsCount).toStrictEqual(50n);
        expect(result.ownNft).toBeFalsy();
    });

    async function sendReturnNft(from: Address, value: bigint, nftAddress: Address) {
        return await blockchain.sendMessage(
            internal({
                from: from,
                to: nftHolder.address,
                value: value,
                body: beginCell()
                    .storeUint(OPCODES.HOLDER_RETURN, 32)
                    .storeUint(0, 64)
                    .storeCoins(0)
                    .storeAddress(nftAddress)
                    .storeAddress(deployer.address)
                    .endCell()
            })
        )
    }

    it('should accept nft', async () => {
        const transfer = await nft.sendTransfer(
            deployer.getSender(), toNano('0.05'), 0, nftHolder.address,
            nftHolder.address, toNano(0.01), beginCell().storeAddress(deployer.address).endCell()
        );
       expect(transfer.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.NFT_OWNERSHIP_ASSIGNED
       });
       const data = await nftHolder.getHolderData();
       expect(data.ownNft).toBeTruthy();
    });

    it('should return nft', async () => {
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.5'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: nft.address,
            success: true,
            op: OPCODES.NFT_TRANSFER
        });
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.EXCESSES
        });
        expect(returnNft.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: masterTreasury.address,
            success: true,
            op: OPCODES.JETTON_BURN_NOTIFICATION
        });
        const data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeFalsy();
        expect(data.lastTakerAddress).toBeNull();
        const nftData = await nft.getNftData();
        expect(nftData.owner!.toString()).toStrictEqual(deployer.address.toString());
    });

    it('error: not own', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftBeforeSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.1'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: deployerJettonWallet,
            to: nftHolder.address,
            success: false,
            exitCode: ERRORS.NOT_OWN
        });
    });

    it('error: wrong nft', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.1'), deployer.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: deployerJettonWallet,
            to: nftHolder.address,
            success: false,
            exitCode: ERRORS.WRONG_NFT
        });
    })

    it('error: unauthorized', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        let returnNft = await sendReturnNft(
            deployer.address, toNano('0.1'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftHolder.address,
            success: false,
            exitCode: ERRORS.UNAUTHORIZED
        });
    });

    it('not enough balance for bounce', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftBeforeSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.023'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: false,
            inMessageBounced: true,
            exitCode: 0,
            actionResultCode: 37
        });

        const data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeFalsy();
        expect(data.lastTakerAddress!.toString()).toStrictEqual(deployer.address.toString());
    });

    it('successful repeat after fail', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftBeforeSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.023'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: false,
            inMessageBounced: true,
            exitCode: 0,
            actionResultCode: 37
        });
        let nftData = await nft.getNftData();
        expect(nftData.owner!.toString()).toStrictEqual(deployer.address.toString());

        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
        returnNft = await blockchain.sendMessage(
            internal({
                from: deployer.address,
                to: nftHolder.address,
                value: toNano('0.5'),
                body: beginCell()
                    .storeUint(OPCODES.HOLDER_REPEAT_RETURN, 32)
                    .storeUint(0, 64)
                    .storeAddress(deployer.address)
                    .endCell()
            })
        );
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.EXCESSES
        });
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);

        let data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeFalsy();
        expect(data.lastTakerAddress).toBeNull();
    });

    it('should be reusable', async () => {
        (await blockchain.getContract(nft.address)).loadFrom(nftAfterSent);
        (await blockchain.getContract(nftHolder.address)).loadFrom(holderAfterSent);
        let returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.6'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.EXCESSES
        });
        expect((await blockchain.getContract(nftHolder.address)).balance).toStrictEqual(40000000n);
        let data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeFalsy();
        expect(data.lastTakerAddress).toBeNull();

        const nftTransfer = await nft.sendTransfer(
            deployer.getSender(), toNano('0.05'), 0, nftHolder.address,
            deployer.address, toNano(0.01), beginCell().storeAddress(deployer.address).endCell()
        );
        expect(nftTransfer.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.NFT_OWNERSHIP_ASSIGNED
        });
        data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeTruthy();

        // 0.31 TON, because in second time contract have a little balance
        // since contract will be used only by jetton wallet, it will handle all fees
        // so, we can do not care about it in these tests
        returnNft = await sendReturnNft(
            deployerJettonWallet, toNano('0.31'), nft.address);
        expect(returnNft.transactions).toHaveTransaction({
            from: nft.address,
            to: nftHolder.address,
            success: true,
            op: OPCODES.EXCESSES
        });
        expect(returnNft.transactions).toHaveTransaction({
            from: nftHolder.address,
            to: masterTreasury.address,
            success: true,
            op: OPCODES.JETTON_BURN_NOTIFICATION
        });
        data = await nftHolder.getHolderData();
        expect(data.ownNft).toBeFalsy();
        expect(data.lastTakerAddress).toBeNull();

        let nftData = await nft.getNftData();
        expect(nftData.owner!.toString()).toStrictEqual(deployer.address.toString());
    });
});
