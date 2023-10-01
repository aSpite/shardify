import { toNano } from 'ton-core';
import { PoolMaster } from '../wrappers/PoolMaster';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const poolMaster = provider.open(PoolMaster.createFromConfig({}, await compile('PoolMaster')));

    await poolMaster.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(poolMaster.address);

    // run methods on `poolMaster`
}
