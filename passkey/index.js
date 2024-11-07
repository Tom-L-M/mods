const _require = file => {
    const fname = process.env.MODULE_NAME + '/' + file;
    const fdirname = __dirname.replaceAll('\\', '/');
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    const final = fdirname.endsWith(m0)
        ? fdirname + '/' + m1
        : fdirname + '/' + fname;
    return require(final);
};

const words = require(exeresolve('passkey/words.json'));
// JSON.parse(require('fs').readFileSync('./passkey/words.json','utf8'));
// Remember: When using it as a compiled package, the execution 'chdir' is one level upper

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

function printVersion() {
    try {
        console.log(_require('package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.2.14
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption>  </caption>
 * // called the script with:
 * // node example.js build --param1 --param2 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseArgv = (mapping = {}, argv = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else params[argv[i]] = true;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

(function main() {
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

    const args = parseArgv({
        h: 'help',
        v: 'version',
        c: 'count',

        W: 'words',
        S: 'separator',
        E: 'no-ending',

        p: 'password',
        t: 'token',
        n: 'numeric',
        a: 'alphabetic',

        l: 'lowercase',
        u: 'uppercase',
    });

    // PARSE ARGUMENTS

    if (args.help) return console.log(help);
    if (args.version) return printVersion();

    // For number of passphrases to generate:
    let numberToGenerate = args.count;
    if (numberToGenerate) context.times = Number(numberToGenerate);

    // For number of words:
    let numberOfWords = args.words;
    if (numberOfWords) context.words = Number(numberOfWords);

    // For separator:
    let separator = args.separator;
    if (separator) context.separator = separator;

    // For ending token:
    if (args['no-ending']) {
        context.endingToken = false;
        context.words -= 1; // remove the word replacer for ending token
    }

    // For password instead of passkey
    if (args.password) {
        context.isPassword = true;
        context.passlength =
            args.password !== true ? args.password : context.passlength;
    }

    // For token instead of passkey
    if (args.token) {
        context.isToken = true;
        context.passlength =
            args.token !== true ? args.token : context.passlength;
    }

    // For numeric instead of passkey
    if (args.numeric) {
        context.isNumeric = true;
        context.passlength =
            args.numeric !== true ? args.numeric : context.passlength;
    }

    // For alphabetic instead of passkey
    if (args.alphabetic) {
        context.isAlphabetic = true;
        context.passlength =
            args.alphabetic !== true ? args.alphabetic : context.passlength;
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
