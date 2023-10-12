import {Blockchain, SandboxContract, TreasuryContract} from '@ton-community/sandbox';
import {beginCell, Cell, toNano} from 'ton-core';
import { NftItem } from '../wrappers/NftItem';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('NftItem', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('NftItem');
    });

    let blockchain: Blockchain;
    let nftItem: SandboxContract<NftItem>;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');

        nftItem = blockchain.openContract(NftItem.createFromConfig({
            index: 0,
            collectionAddress: deployer.address
        }, code));

        const deployResult = await nftItem.sendDeploy(
            deployer.getSender(), toNano('0.05'), user.address, beginCell().storeStringTail('Hello, TON!').endCell()
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftItem.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        const result = await nftItem.getNftData();
        const contentHash = beginCell().storeStringTail('Hello, TON!').endCell().hash();
        expect(result.init).toBeTruthy();
        expect(result.index).toStrictEqual(0);
        expect(result.collectionAddress.toString()).toStrictEqual(deployer.address.toString());
        expect(result.owner!.toString()).toStrictEqual(user.address.toString());
        expect(result.content!.hash()).toStrictEqual(contentHash);
    });

    it('should transfer', async () => {
        const transferResult = await nftItem.sendTransfer(
            user.getSender(), toNano('0.05'), 0, deployer.address, user.address, toNano(0),
        );
        expect(transferResult.transactions).toHaveTransaction({
            from: user.address,
            to: nftItem.address,
            success: true,
        });
        const result = await nftItem.getNftData();
        expect(result.owner!.toString()).toStrictEqual(deployer.address.toString());
    });
});
