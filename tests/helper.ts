import {Address, beginCell, Cell} from "ton-core";

export function getJettonWallet(ownerAddress: Address, jettonMasterAddress: Address, jettonWalletCode: Cell) {
    const data = beginCell()
        .storeCoins(0)
        .storeAddress(ownerAddress)
        .storeAddress(jettonMasterAddress)
        .storeRef(jettonWalletCode)
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