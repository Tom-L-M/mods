const { ArgvParser } = require('../shared');

// Returns a random int between 'min' and 'max' ('min' is inclusive, 'max' is exclusive)
const randomInt = (min = 0, max = 100) =>
    Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min))) +
    Math.ceil(min);

// Returns an array of N randomly chosen items from an original array
// E.g.  samples([1,2,3], 2) // returns [1,2] or [1,3] or [2,1] or [2,3]
const samples = ([...arr], sampleSize = 1) => {
    let m = arr.length;
    while (m) {
        const i = Math.floor(Math.random() * m--);
        [arr[m], arr[i]] = [arr[i], arr[m]];
    }
    return arr.slice(0, sampleSize);
};

(function () {
    const help = `
    [passkey-js]
        A tool for generating random passkeys.
    
        passkey [options]

    Options:
        -h | --help           Prints the help message and quits.
        -v | --version        Prints the version info and quits.
        -c | --count N        Number of passphrases to generate (defaults to 1).
        -l | --lowercase      Returns the string as lowercase.
        -u | --uppercase      Returns the string as uppercase.
    
    Passphrase-specific options:
        -W | --words N        Number of words in passphrase (defaults to 3)
        -S | --separator N    Separator for passphrase (defaults to "-")
        -E | --no-ending      Remove ending symbols in the passphrase

    Alternatives to passphrase generation:
    (overrides passphrase-specific options and change the generated string)
        -p | --password N     Generates a password (length N and all char types)
        -t | --token N        Generates a token (length N and [0-9A-Za-z])
        -n | --numeric N      Generates a numeric string (length N and [0-9])
        -a | --alphabetic N   Generates an alphabetic string (length N and [A-Za-z])`;

    // Set context namespace
    const context = {};
    // Set default configs
    context.times = 1; // number of passphrases to generate
    context.words = 3; // number of words per passphrasee
    context.separator = '-';
    context.passlength = 12;
    context.endingToken = true;

    context.isPassword = false;
    context.isToken = false;
    context.isNumeric = false;
    context.isAlphabetic = false;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('count', { alias: 'c', allowCasting: true });
    parser.option('lowercase', { alias: 'l', allowValue: false });
    parser.option('uppercase', { alias: 'u', allowValue: false });
    parser.option('words', { alias: 'W', allowCasting: true });
    parser.option('separator', { alias: 'S' });
    parser.option('no-ending', { alias: 'E', allowValue: false });
    parser.option('password', { alias: 'p', allowCasting: true });
    parser.option('token', { alias: 't', allowCasting: true });
    parser.option('numeric', { alias: 'n', allowCasting: true });
    parser.option('alphabetic', { alias: 'a', allowCasting: true });
    const args = parser.parseArgv();

    // PARSE ARGUMENTS

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help) return console.log(help);

    // For number of passphrases to generate:
    let numberToGenerate = args.count;
    if (numberToGenerate) context.times = numberToGenerate;

    // For number of words:
    let numberOfWords = args.words;
    if (numberOfWords) context.words = numberOfWords;

    // For separator:
    let separator = args.separator;
    if (separator) context.separator = separator;

    // For ending token:
    if (args['no-ending']) {
        context.endingToken = false;
        context.words -= 1; // remove the word replacer for ending token
    }

    // For password instead of passkey
    if (args.password && typeof args.password !== 'boolean') {
        context.isPassword = true;
        context.passlength = args.password;
    }

    // For token instead of passkey
    if (args.token && typeof args.token !== 'boolean') {
        context.isToken = true;
        context.passlength = args.token;
    }

    // For numeric instead of passkey
    if (args.numeric && typeof args.numeric !== 'boolean') {
        context.isNumeric = true;
        context.passlength = args.numeric;
    }

    // For alphabetic instead of passkey
    if (args.alphabetic && typeof args.alphabetic !== 'boolean') {
        context.isAlphabetic = true;
        context.passlength = args.alphabetic;
    }

    let results = [];

    function generateCustom(size, chars) {
        let acc = '';
        const charlist = chars.split('');
        for (let i = 0; i < size; i++)
            acc += charlist[randomInt(0, charlist.length)];
        return acc;
    }

    const CHARS = {
        alphalow: 'abcdefghijklmnopqrstuvwxyz',
        alphahigh: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numeric: '01234567890123456789',
        special: '!@#$%&*;:',
    };

    if (context.isPassword) {
        const chars =
            (args.lowercase
                ? CHARS.alphalow
                : args.uppercase
                ? CHARS.alphahigh
                : CHARS.alphalow + CHARS.alphahigh) +
            CHARS.numeric +
            CHARS.special;
        for (let i = 0; i < context.times; i++)
            results.push(generateCustom(context.passlength, chars));
        return console.log(results.join('\n'));
    }

    if (context.isToken) {
        const chars =
            (args.lowercase
                ? CHARS.alphalow
                : args.uppercase
                ? CHARS.alphahigh
                : CHARS.alphalow + CHARS.alphahigh) + CHARS.numeric;
        for (let i = 0; i < context.times; i++)
            results.push(generateCustom(context.passlength, chars));
        return console.log(results.join('\n'));
    }

    if (context.isNumeric) {
        const chars = CHARS.numeric;
        for (let i = 0; i < context.times; i++)
            results.push(generateCustom(context.passlength, chars));
        return console.log(results.join('\n'));
    }

    if (context.isAlphabetic) {
        const chars = args.lowercase
            ? CHARS.alphalow
            : args.uppercase
            ? CHARS.alphahigh
            : CHARS.alphalow + CHARS.alphahigh;
        for (let i = 0; i < context.times; i++)
            results.push(generateCustom(context.passlength, chars));
        return console.log(results.join('\n'));
    }

    const words = require('./words.json');
    // JSON.parse(require('fs').readFileSync('./passkey/words.json','utf8'));
    // Remember: When using it as a compiled package, the execution 'chdir' is one level upper

    // START PASSPHRASE GENERATION:
    // Set 'digits' array
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const specials = ['#']; // currently using only '#', as it is easier to remember
    for (let i = 0; i < context.times; i++) {
        // Get X random words from the wordlist
        let passphrase = samples(words, 1 + context.words);

        // Get a random digit sequence from 'digits' array
        let passdigit = samples(digits, 1).join('');

        // Get a random special char from 'specials' array
        let special = samples(specials, 1).join('');

        if (context.endingToken) {
            // Replace one word for a capital letter + 2 Digits
            // Info: This 3-letter pseudo-word is important for
            //  passing both capital-letter-checking and number
            //  checking on password input fields.
            passphrase[passphrase.length - 1] = [
                // Position the special char
                special,
                // Capitalize first letter
                passphrase[passphrase.length - 1][0].toUpperCase(),
                // Position the digit
                passdigit,
            ].join('');
        }

        // Merge words
        passphrase = passphrase.join(context.separator);

        // Push to results
        results.push(passphrase);
    }

    return console.log(results.join('\n'));
})();
