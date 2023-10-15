import {Blockchain, SandboxContract, TreasuryContract} from '@ton-community/sandbox';
import {beginCell, Cell, toNano} from 'ton-core';
import { NftHolder } from '../wrappers/NftHolder';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import {JettonMinter} from "../wrappers/JettonMinter";

describe('NftHolder', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('NftHolder');
    });

    let blockchain: Blockchain;
    let nftHolder: SandboxContract<NftHolder>;
    let jettonMaster: SandboxContract<JettonMinter>;
    let jettonWalletCode: Cell = Cell.EMPTY;
    let deployer: SandboxContract<TreasuryContract>;
    let masterTreasury: SandboxContract<TreasuryContract>;
    let nftTreasury: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        jettonWalletCode   = await compile('JettonWallet');
        deployer       = await blockchain.treasury('deployer');
        masterTreasury = await blockchain.treasury('jettonMaster');
        nftTreasury    = await blockchain.treasury('nftTreasury');
        const defaultContent = beginCell().endCell();
        jettonMaster = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: defaultContent,
                    wallet_code: jettonWalletCode,
                },
                await compile('JettonMinter')));

        nftHolder = blockchain.openContract(NftHolder.createFromConfig({
            jettonMasterAddress: masterTreasury.address, // treasury address for tests
            nftAddress: nftTreasury.address
        }, code));

        const deployResult = await nftHolder.sendDeploy(
            masterTreasury.getSender(), toNano('0.05'), 50n, nftTreasury.address, Cell.EMPTY
            );

        expect(deployResult.transactions).toHaveTransaction({
            from: masterTreasury.address,
            to: nftHolder.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        const result = await nftHolder.getHolderData();
        expect(result.jettonMasterAddress.toString()).toStrictEqual(masterTreasury.address.toString());
        expect(result.nftAddress.toString()).toStrictEqual(nftTreasury.address.toString());
        expect(result.partsCount).toStrictEqual(50n);
        expect(result.ownNft).toStrictEqual(false);
    });

});
