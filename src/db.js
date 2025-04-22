const fs = require("fs");
const path = require('path');

const DB_FILE_DIR = process.env.DB_FILE_DIR || './data';
const DB_FILE_PATH = path.join(DB_FILE_DIR, 'data.json');

console.log('DB_FILE_DIR', DB_FILE_DIR)
console.log('DB_FILE_PATH', DB_FILE_PATH)

async function ensureDbFile(){
    try {
        let access = await fs.promises.access(DB_FILE_PATH);
        console.log('Checking for data.json',{
            access
        })
        
    } catch (error) {
        
        await fs.promises.writeFile(DB_FILE_PATH, JSON.stringify({}), 'utf8');
        console.log('Created data.json')
    }
}

async function persistAccessToken(accessToken) {
    await setData('accessToken', accessToken);
}

async function persistRefreshToken(refreshToken) {
    await setData('refreshToken', refreshToken);
}

async function getData(key, defaultValue = null) {
    try {
        const data = JSON.parse(await fs.promises.readFile(DB_FILE_PATH, 'utf8'));
        return data[key] || defaultValue;
    } catch (error) {
        console.error(`Error getting ${key}:`, error);
        return null;
    }
}

async function setData(key, value) {
    try {
        const data = JSON.parse(await fs.promises.readFile(DB_FILE_PATH, 'utf8'));
        data[key] = value;
        await fs.promises.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2));
        /* console.log(`${key} persisted successfully`, {
            value: typeof value === 'string' ? value.slice(0, 10) + '...' : '(Object)'
        }) */;
    } catch (error) {
        console.error(`Error persisting ${key}:`, error);
    }
}

async function getById(key,id, idKey='id'){
    const data = await getData(key)
    if (!data) {
        return null
    }
    return data.find(item => item[idKey] === id)
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
            //console.log('Match found, updating', match,value)
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

async function getAllData() {
    try {
        const data = await fs.promises.readFile(DB_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error getting all data:`, error);
        // Return an empty object or handle appropriately if file doesn't exist or is invalid
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error; // Re-throw other errors
    }
}

async function setAllData(newData) {
    try {
        // Basic validation: Ensure it's an object
        if (typeof newData !== 'object' || newData === null) {
            throw new Error('Invalid data format: Must be a JSON object.');
        }
        await fs.promises.writeFile(DB_FILE_PATH, JSON.stringify(newData, null, 2));
        console.log('Database overwritten successfully.');
    } catch (error) {
        console.error(`Error setting all data:`, error);
        throw error; // Re-throw to be handled by the caller
    }
}

module.exports = {
    ensureDbFile,
    persistAccessToken,
    persistRefreshToken,
    getData,
    setData,
    setDataPushIfNotExists,
    setDataPushUpdateIfExists,
    pruneDupes,
    getById,
    getAllData,
    setAllData
}