import { toNano } from 'ton-core';
import { NftHolder } from '../wrappers/NftHolder';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const nftHolder = provider.open(NftHolder.createFromConfig({}, await compile('NftHolder')));

    await nftHolder.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(nftHolder.address);

    // run methods on `nftHolder`
}
