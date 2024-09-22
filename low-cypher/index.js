// Use to create low-security-level cyphers, like NATO, XOR, ROT13, Caesar...
const reverseObject = obj =>
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]));

const missingParam = str =>
    console.log('Error: Missing parameter [' + str + ']');

const invalidParam = str =>
    console.log('Error: Invalid parameter [' + str + ']');

const CYPHERS = {};

// ----- NATO -----
// Ex:  low-cypher nato <d/decrypt|e/encrypt> <-d/--data data>
CYPHERS.NATO = {};
CYPHERS.NATO.CYPHER_TABLE = {
    A: 'alpha',
    B: 'bravo',
    C: 'charlie',
    D: 'delta',
    E: 'echo',
    F: 'foxtrot',
    G: 'golf',
    H: 'hotel',
    I: 'india',
    J: 'juliett',
    K: 'kilo',
    L: 'lima',
    M: 'mike',
    N: 'november',
    O: 'oscar',
    P: 'papa',
    Q: 'quebec',
    R: 'romeo',
    S: 'sierra',
    T: 'tango',
    U: 'uniform',
    V: 'victor',
    W: 'whiskey',
    X: 'x-ray',
    Y: 'yankee',
    Z: 'zulu',
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    '-': 'dash',
    '.': 'stop',
    ' ': '...',
};
CYPHERS.NATO.REVERSE_CYPHER_TABLE = reverseObject(CYPHERS.NATO.CYPHER_TABLE);
(CYPHERS.NATO.encrypt = (str = '') =>
    str
        .split('')
        .map(x => CYPHERS.NATO.CYPHER_TABLE[x.toUpperCase()] || '')
        .join(' ')
        .toLowerCase()),
    (CYPHERS.NATO.decrypt = (str = '') =>
        str
            .split(' ')
            .map(x => CYPHERS.NATO.REVERSE_CYPHER_TABLE[x.toLowerCase()] || '')
            .join('')
            .toLowerCase());
CYPHERS.NATO.handler = args => {
    let opts = { data: '', operation: null };
    if (args[0] === 'd' || args[0] === 'decrypt') opts.operation = 'd';
    if (args[0] === 'e' || args[0] === 'encrypt') opts.operation = 'e';
    for (let i = 1; i < args.length; i++) {
        let now = args[i];
        let next = args[i + 1];
        if (now == '-d' || now == '--data') {
            opts.data += next;
            i++;
        } else return invalidParam(now);
    }
    if (!opts.operation) return missingParam('operation');
    if (!opts.data) return missingParam('data');
    if (opts.operation == 'd') return CYPHERS.NATO.decrypt(opts.data);
    if (opts.operation == 'e') return CYPHERS.NATO.encrypt(opts.data);
};
// ----- NATO -----

// ----- MORSE -----
// Ex:  low-cypher morse <d/decrypt|e/encrypt> <-d/--data data>
CYPHERS.MORSE = {};
CYPHERS.MORSE.CYPHER_TABLE = {
    A: '.-',
    B: '-...',
    C: '-.-.',
    D: '-..',
    E: '.',
    F: '..-.',
    G: '--.',
    H: '....',
    I: '..',
    J: '.---',
    K: '-.-',
    L: '.-..',
    M: '--',
    N: '-.',
    O: '---',
    P: '.--.',
    Q: '--.-',
    R: '.-.',
    S: '...',
    T: '-',
    U: '..-',
    V: '...-',
    W: '.--',
    X: '-..-',
    Y: '-.--',
    Z: '--..',
    0: '-----',
    1: '.----',
    2: '..---',
    3: '...--',
    4: '....-',
    5: '.....',
    6: '-....',
    7: '--...',
    8: '---..',
    9: '----.',
    ' ': '/',
};
CYPHERS.MORSE.REVERSE_CYPHER_TABLE = reverseObject(CYPHERS.MORSE.CYPHER_TABLE);
CYPHERS.MORSE.encrypt = (str = '') =>
    str
        .split('')
        .map(x => CYPHERS.MORSE.CYPHER_TABLE[x.toUpperCase()] || '')
        .join(' ');
CYPHERS.MORSE.decrypt = (str = '') =>
    str
        .split(' ')
        .map(x => CYPHERS.MORSE.REVERSE_CYPHER_TABLE[x] || '')
        .join('')
        .toLowerCase();
CYPHERS.MORSE.handler = args => {
    let opts = { data: '', operation: null };
    if (args[0] === 'd' || args[0] === 'decrypt') opts.operation = 'd';
    if (args[0] === 'e' || args[0] === 'encrypt') opts.operation = 'e';
    for (let i = 1; i < args.length; i++) {
        let now = args[i];
        let next = args[i + 1];
        if (now == '-d' || now == '--data') {
            opts.data += next;
            i++;
        } else return invalidParam(now);
    }
    if (!opts.data) return missingParam('data');
    if (!opts.operation) return missingParam('operation');
    if (opts.operation == 'd') return CYPHERS.MORSE.decrypt(opts.data);
    if (opts.operation == 'e') return CYPHERS.MORSE.encrypt(opts.data);
};
// ----- MORSE -----

// ----- ATBASH -----
// Ex:  low-cypher atbash <-d/--data data>
CYPHERS.ATBASH = {};
CYPHERS.ATBASH.CYPHER_TABLE = {
    A: 'Z',
    B: 'Y',
    C: 'X',
    D: 'W',
    E: 'V',
    F: 'U',
    G: 'T',
    H: 'S',
    I: 'R',
    J: 'Q',
    K: 'P',
    L: 'O',
    M: 'N',
    N: 'M',
    O: 'L',
    P: 'K',
    Q: 'J',
    R: 'I',
    S: 'H',
    T: 'G',
    U: 'F',
    V: 'E',
    W: 'D',
    X: 'C',
    Y: 'B',
    Z: 'A',
};
CYPHERS.ATBASH.encrypt = (str = '') =>
    str
        .split('')
        .map(x => CYPHERS.ATBASH.CYPHER_TABLE[x.toUpperCase()] || x)
        .join('')
        .toLowerCase();
CYPHERS.ATBASH.handler = args => {
    let opts = { data: '' };
    for (let i = 0; i < args.length; i++) {
        let now = args[i];
        let next = args[i + 1];
        if (now == '-d' || now == '--data') {
            opts.data += next;
            i++;
        } else return invalidParam(now);
    }
    if (!opts.data) return missingParam('data');
    return CYPHERS.ATBASH.encrypt(opts.data);
};
// ----- ATBASH -----

// low-cypher <TYPE> [other parameters...]
// Ex:  low-cypher nato <d/decrypt|e/encrypt> <-d/--data data>
// Ex:  low-cypher morse <d/decrypt|e/encrypt> <-d/--data data>
// Ex:  low-cypher atbash <-d/--data data>

// To add more cyphers:
// Append an object with the cypher name in the 'CYPHERS' object
// In the pbject, add a 'hendler' method.
// This method receives an array of parameters passed to encryption,
// and must parse it into a usable resource for the cypher method
// You can pass multiple '-d' options in sequence, to concat multiple data blocks

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('low-cypher/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const help = `
    [low-cypher-js]
        A tool for running low-level and pseudo-encryption (atbash, morse, nato...).

    Usage: 
        low-cypher nato    [options] <d/decrypt|e/encrypt> <-d/--data data>
        low-cypher morse   [options] <d/decrypt|e/encrypt> <-d/--data data>
        low-cypher atbash  [options] <-d/--data data>

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info:
        > Each encryption method has its own different parameter scheme.
        > You can pass multiple '-d' options in sequence, to concat multiple data blocks
    Ex:
        > low-cypher nato e -d "hello"      // -> "hotel echo lima lima oscar"`;
    const args = process.argv.slice(2);
    const cyphername = args.shift();
    if (!cyphername || args.includes('-h') || args.includes('--help'))
        return console.log(help);
    if (args.includes('-v') || args.includes('--version'))
        return printVersion();
    if (!CYPHERS[cyphername.toUpperCase()])
        return console.log('Error: Invalid cypher type [' + cyphername + ']');
    return console.log(CYPHERS[cyphername.toUpperCase()].handler(args));
})();
