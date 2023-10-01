import { toNano } from 'ton-core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinter = provider.open(JettonMinter.createFromConfig({}, await compile('JettonMinter')));

    await jettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jettonMinter.address);

    // run methods on `jettonMinter`
}
