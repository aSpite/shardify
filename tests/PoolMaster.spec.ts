import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { PoolMaster } from '../wrappers/PoolMaster';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('PoolMaster', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('PoolMaster');
    });

    let blockchain: Blockchain;
    let poolMaster: SandboxContract<PoolMaster>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        poolMaster = blockchain.openContract(PoolMaster.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await poolMaster.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: poolMaster.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and poolMaster are ready to use
    });
});
