const { ArgvParser } = require('../shared');

// Split a string in chunks of N size
const chunk = (string, chunkSize = 1) =>
    string.match(new RegExp(`.{1,${chunkSize >= 1 ? chunkSize : 1}}`, 'gim')) ??
    [];

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

// Merge a string an a mask, replacing chars of the mask with chars from the string
const applyMaskToString = (str = '', mask = '') => {
    let c = 0;
    return mask
        .toString()
        .split('')
        .map(v => (v === '#' ? str?.[c++] || v : v))
        .join('');
};

(function () {
    const help = `
    [passkey-js]
        A tool for generating random passkeys.
    
        passkey [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -c | --count N          Number of passphrases to generate (defaults to 1).
        -l | --lowercase        Returns the string as lowercase.
        -u | --uppercase        Returns the string as uppercase.
    
    Passphrase options:
        -W | --words N          Number of words in passphrase (defaults to 3)
        -S | --separator N      Separator for passphrase (defaults to "-")
        -E | --no-ending        Remove ending symbols in the passphrase

    Alternatives to passphrase generation:
    (Overrides passphrase-specific options and change the generated string)
        -p | --password N       Generates a password (length N and all char types)
        -t | --token N          Generates a token (length N and [0-9A-Za-z])
        -n | --numeric N        Generates a numeric string (length N and [0-9])
        -a | --alphabetic N     Generates an alphabetic string (length N and [A-Za-z])
    
    Alternative options:
    (Ineffective for passphrases)
        -A | --split-at N       Splits the string at every Nth position with a dash.
        -S | --separator N      When used with -a, changes the dash for another char.
        -M | --mask ####...     Uses a mask for formatting the generated string.
                                Every '#' char in the mask will be replaced by a char
                                from the generated string. Other chars will be just copied.
        `;

    // Set ctx namespace
    const ctx = {};
    // Set default configs
    ctx.times = 1; // number of passphrases to generate
    ctx.words = 3; // number of words per passphrasee
    ctx.separator = '-';
    ctx.passlength = 12;
    ctx.endingToken = true;
    ctx.uppercase = false;
    ctx.lowercase = false;

    ctx.isPassword = false;
    ctx.isToken = false;
    ctx.isNumeric = false;
    ctx.isAlphabetic = false;

    ctx.splitAt = null;
    ctx.splitWith = '-';
    ctx.mask = null;

    const parser = new ArgvParser();

    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('count', { alias: 'c', allowCasting: true });
    parser.option('lowercase', { alias: 'l', allowValue: false });
    parser.option('uppercase', { alias: 'u', allowValue: false });

    parser.option('words', { alias: 'W', allowCasting: true });
    parser.option('separator', { alias: 'S', allowDash: true });
    parser.option('no-ending', { alias: 'E', allowValue: false });

    parser.option('password', { alias: 'p', allowCasting: true });
    parser.option('token', { alias: 't', allowCasting: true });
    parser.option('numeric', { alias: 'n', allowCasting: true });
    parser.option('alphabetic', { alias: 'a', allowCasting: true });

    parser.option('split-at', { alias: 'A', allowCasting: true });
    parser.option('mask', { alias: 'M' });

    const args = parser.parseArgv();

    // PARSE ARGUMENTS

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help) return console.log(help);

    // For number of passphrases to generate:
    if (args.count) ctx.times = args.count;

    // For number of words:
    if (args.words) ctx.words = args.words;

    // For separator:
    if (args.separator) ctx.separator = args.separator;

    // For string case
    if (args.uppercase) ctx.uppercase = args.uppercase;
    if (args.lowercase) ctx.lowercase = args.lowercase;

    // For alternative options:
    if (args['split-at'] && typeof args['split-at'] === 'number')
        ctx.splitAt = args['split-at'];
    if (args.separator && typeof args.separator === 'string')
        ctx.splitWith = args.separator;
    if (args.mask && typeof args.mask === 'string') ctx.mask = args.mask;

    // For ending token:
    if (args['no-ending']) {
        ctx.endingToken = false;
        ctx.words -= 1; // remove the word replacer for ending token
    }

    // For password instead of passkey
    if (args.password && typeof args.password !== 'boolean') {
        ctx.isPassword = true;
        ctx.passlength = args.password;
    }

    // For token instead of passkey
    if (args.token && typeof args.token !== 'boolean') {
        ctx.isToken = true;
        ctx.passlength = args.token;
    }

    // For numeric instead of passkey
    if (args.numeric && typeof args.numeric !== 'boolean') {
        ctx.isNumeric = true;
        ctx.passlength = args.numeric;
    }

    // For alphabetic instead of passkey
    if (args.alphabetic && typeof args.alphabetic !== 'boolean') {
        ctx.isAlphabetic = true;
        ctx.passlength = args.alphabetic;
    }

    let results = [];

    function generateCustom(size, chars) {
        let acc = '';
        const charlist = chars.split('');
        for (let i = 0; i < size; i++)
            acc += charlist[randomInt(0, charlist.length)];
        return acc;
    }

    // ------------------------
    // Start string generation:
    // ------------------------

    const CHARS = {
        alphalow: 'abcdefghijklmnopqrstuvwxyz',
        alphahigh: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numeric: '01234567890123456789',
        special: '!@#$%&*;:',
    };

    if (ctx.isPassword) {
        const chars =
            (ctx.lowercase
                ? CHARS.alphalow
                : ctx.uppercase
                ? CHARS.alphahigh
                : CHARS.alphalow + CHARS.alphahigh) +
            CHARS.numeric +
            CHARS.special;
        for (let i = 0; i < ctx.times; i++)
            results.push(generateCustom(ctx.passlength, chars));

        if (ctx.mask) {
            results = results.map(v => applyMaskToString(v, ctx.mask));
        } else if (ctx.splitAt) {
            results = results.map(v =>
                chunk(v, ctx.splitAt).join(ctx.splitWith)
            );
        }

        return console.log(results.join('\n'));
    }

    if (ctx.isToken) {
        const chars =
            (ctx.lowercase
                ? CHARS.alphalow
                : ctx.uppercase
                ? CHARS.alphahigh
                : CHARS.alphalow + CHARS.alphahigh) + CHARS.numeric;
        for (let i = 0; i < ctx.times; i++)
            results.push(generateCustom(ctx.passlength, chars));

        if (ctx.mask) {
            results = results.map(v => applyMaskToString(v, ctx.mask));
        } else if (ctx.splitAt) {
            results = results.map(v =>
                chunk(v, ctx.splitAt).join(ctx.splitWith)
            );
        }

        return console.log(results.join('\n'));
    }

    if (ctx.isNumeric) {
        const chars = CHARS.numeric;
        for (let i = 0; i < ctx.times; i++)
            results.push(generateCustom(ctx.passlength, chars));

        if (ctx.mask) {
            results = results.map(v => applyMaskToString(v, ctx.mask));
        } else if (ctx.splitAt) {
            results = results.map(v =>
                chunk(v, ctx.splitAt).join(ctx.splitWith)
            );
        }

        return console.log(results.join('\n'));
    }

    if (ctx.isAlphabetic) {
        const chars = ctx.lowercase
            ? CHARS.alphalow
            : ctx.uppercase
            ? CHARS.alphahigh
            : CHARS.alphalow + CHARS.alphahigh;
        for (let i = 0; i < ctx.times; i++)
            results.push(generateCustom(ctx.passlength, chars));

        if (ctx.mask) {
            results = results.map(v => applyMaskToString(v, ctx.mask));
        } else if (ctx.splitAt) {
            results = results.map(v =>
                chunk(v, ctx.splitAt).join(ctx.splitWith)
            );
        }

        return console.log(results.join('\n'));
    }

    // ------------------------
    // If it is a passhphrase:
    // ------------------------

    const words = require('./words.json');

    // START PASSPHRASE GENERATION:
    // Set 'digits' array
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const specials = ['#']; // currently using only '#', as it is easier to remember
    for (let i = 0; i < ctx.times; i++) {
        // Get X random words from the wordlist
        let passphrase = samples(words, 1 + ctx.words);

        // Get a random digit sequence from 'digits' array
        let passdigit = samples(digits, 1).join('');

        // Get a random special char from 'specials' array
        let special = samples(specials, 1).join('');

        if (ctx.endingToken) {
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
        passphrase = passphrase.join(ctx.separator);

        if (ctx.uppercase) passphrase = passphrase.toUpperCase();

        // Push to results
        results.push(passphrase);
    }

    return console.log(results.join('\n'));
})();
