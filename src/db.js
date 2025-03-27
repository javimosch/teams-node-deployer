const fs = require("fs");

async function persistAccessToken(accessToken) {
    await setData('accessToken', accessToken);
}

async function persistRefreshToken(refreshToken) {
    await setData('refreshToken', refreshToken);
}

async function getData(key) {
    try {
        const data = JSON.parse(await fs.promises.readFile('data.json', 'utf8'));
        return data[key];
    } catch (error) {
        console.error(`Error getting ${key}:`, error);
        return null;
    }
}

async function setData(key, value) {
    try {
        const data = JSON.parse(await fs.promises.readFile('data.json', 'utf8'));
        data[key] = value;
        await fs.promises.writeFile('data.json', JSON.stringify(data, null, 2));
        console.log(`${key} persisted successfully`, {
            value: typeof value === 'string' ? value.slice(0, 10) + '...' : '(Object)'
        });
    } catch (error) {
        console.error(`Error persisting ${key}:`, error);
    }
}

async function setDataPushIfNotExists(key, value, handler) {
    let data = await getData(key)
    if (!data) {
        data = []
        data.push(value)
    }else{
        if(data.length>0){
            let match = data.find(handler)
            if(!match){
                data.push(value)
            }
        }else{
            data.push(value)
        }
    }
    await setData(key, data)
}

async function setDataPushUpdateIfExists(key, value, handler) {
   let data = await getData(key)
   if (!data) {
    data = []
   }else{
    if(data.length>0){
        let match = data.find(handler)
        if(match){
            for(const key in value){
                match[key] = value[key]
            }
            console.log('Match found, updating', match,value)
        }else{
            data.push(value)
        }
    }else{
        data.push(value)
    }
   }
   await setData(key, data)
}

async function pruneDupes(key,idKey='id'){
    let data = await getData(key)
    if (!data) {
        return
    }
    data = data.filter((item, index) => {
        return data.findIndex(t => t[idKey] === item[idKey]) === index
    })
    await setData(key, data)
}

module.exports = {
    persistAccessToken,
    persistRefreshToken,
    getData,
    setData,
    setDataPushIfNotExists,
    setDataPushUpdateIfExists,
    pruneDupes
}