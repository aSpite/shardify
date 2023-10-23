import {Address, beginCell, Cell} from "ton-core";

export function getJettonWallet(ownerAddress: Address, jettonMasterAddress: Address, jettonWalletCode: Cell,
                                partsCount: bigint, holderCode: Cell) {
    const data = beginCell()
        .storeCoins(0)
        .storeAddress(ownerAddress)
        .storeAddress(jettonMasterAddress)
        .storeRef(jettonWalletCode)
        .storeCoins(partsCount)
        .storeRef(holderCode)
        .endCell();

    const stateInit = beginCell()
        .storeUint(0, 2)
        .storeBit(true)
        .storeRef(jettonWalletCode)
        .storeBit(true)
        .storeRef(data)
        .storeBit(false)
        .endCell();

    return new Address(0, stateInit.hash());
}

export function bufferToBigInt(x: Buffer) {
    return BigInt('0x' + x.toString('hex'))
}