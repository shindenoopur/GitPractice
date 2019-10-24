/**
 * Created by chaitanya on 5/11/17.
 */
const SimpleStorage = artifacts.require('SimpleStorage');

module.exports = function(callback) {
    // perform actions
    let simpleStorageInstance = null;
    let setValue = 155;

    SimpleStorage.deployed().then(function (instance) {
        //console.log(instance)
        simpleStorageInstance = instance;
        console.log("Address of contract : ", simpleStorageInstance.address);
        return simpleStorageInstance.get.call();
    }).then(function (balance) {
        console.log('Blockchain Balance is : ', balance.toNumber())
        return 0;
    }).then(function () {
        console.log('Setting Balance to : ', setValue);
        return simpleStorageInstance.set(setValue);
    }).then(function () {
        return simpleStorageInstance.get.call();
    }).then(function (balance) {
        console.log('Balance is : ', balance.toNumber())
        return 0;
    })
}

