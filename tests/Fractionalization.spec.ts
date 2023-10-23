import {Blockchain, SandboxContract, TreasuryContract} from '@ton-community/sandbox';
import {Address, beginCell, Cell, toNano} from 'ton-core';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {KeyPair, mnemonicToWalletKey} from "ton-crypto";
import {bufferToBigInt, getJettonWallet} from "./helper";

describe('Fractionalization', () => {
    let blockchain: Blockchain
    let admin: SandboxContract<TreasuryContract>;
    let poolCreator: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let keyPair: KeyPair;
    const collectionAddress = Address.parse('EQAVGhk_3rUA3ypZAZ1SkVGZIaDt7UdvwA4jsSGRKRo-MRDN');
    const nftAddress = Address.parse('EQA3tiXRxGrbobJiBEDMgl7Lp47uCBb4cG4PPSB72LI6MbOc');

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        const nftHolderCode = await compile('NftHolder')
        const jettonWalletCode = await compile('JettonWallet');
        const minterContent = beginCell().storeUint(333, 32).endCell();

        admin = await blockchain.treasury('admin');
        poolCreator = await blockchain.treasury('pool creator');
        user = await blockchain.treasury('user');
        keyPair = await mnemonicToWalletKey('harbor lobster spin vessel lamp text check magic stone element abstract guide citizen praise tube reject patch what stuff space fork radio symbol brother'.split(' '));

        jettonMinter = blockchain.openContract(JettonMinter.createFromConfig({
                admin: admin.address,
                content: minterContent,
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
        let deployResult = await jettonMinter.sendDeploy(admin.getSender(), toNano(1));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: jettonMinter.address,
            deploy: true,
            success: true
        });
        let data = await jettonMinter.getJettonData();
        expect(data.content.hash().toString('hex')).toStrictEqual(minterContent.hash().toString('hex'));
        expect((await jettonMinter.getWalletAddress(user.address)).toString())
            .toStrictEqual(getJettonWallet(user.address, jettonMinter.address, jettonWalletCode, 50n, nftHolderCode).toString());
    });

    // beforeEach(async () => {
    //
    // });

    it('should deploy', async () => {

    });
});
