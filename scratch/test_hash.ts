import bcrypt from 'bcryptjs';

async function test() {
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Single hash:', hash);
    
    const isMatch = await bcrypt.compare(password, hash);
    console.log('Match single:', isMatch);
    
    const doubleHash = await bcrypt.hash(hash, salt);
    console.log('Double hash:', doubleHash);
    
    const isMatchDouble = await bcrypt.compare(password, doubleHash);
    console.log('Match double (should be false):', isMatchDouble);
}

test();
