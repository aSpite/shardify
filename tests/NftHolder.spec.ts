import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { NftHolder } from '../wrappers/NftHolder';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('NftHolder', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('NftHolder');
    });

    let blockchain: Blockchain;
    let nftHolder: SandboxContract<NftHolder>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        nftHolder = blockchain.openContract(NftHolder.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await nftHolder.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftHolder.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nftHolder are ready to use
    });
});
