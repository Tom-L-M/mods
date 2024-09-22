const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
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
        console.log(require(exeresolve('passkey/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
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
    // Set help message:
    const help = `
    [passkey-js]
        A tool for generating random passkeys.
    
    passkey [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -c | --count X      Number of passphrases to generate (defaults to 1)
        -w | --words X      Number of words in passphrase (defaults to 3)
        -s | --separator X  Separator for passphrase (defaults to "-")
        -e | --no-ending    Remove ending token
        -p | --password X   Creates a password instead of passphrase 
                            (one word with length X and all char types)
                            (this overrides other flags, except '-n')`;

    // Set context namespace
    const context = {};
    // Set default configs
    context.times = 1; // number of passphrases to generate
    context.words = 3; // number of words per passphrasee
    context.separator = '-';
    context.endingToken = true;
    context.isPassword = false;
    context.passlength = 12;

    const args = parseArgv({
        h: 'help',
        v: 'version',
        c: 'count',
        w: 'words',
        s: 'separator',
        e: 'no-ending',
        p: 'password',
    });

    // PARSE ARGUMENTS

    // Return help if no args
    if (args.help) return console.log(help);

    if (args.version) return printVersion();

    // For number of passphrases to generate:
    let numberToGenerate = args.count;
    if (!!numberToGenerate) context.times = Number(numberToGenerate);
    // For number of words:
    let numberOfWords = args.words;
    if (!!numberOfWords) context.words = Number(numberOfWords);
    // For separator:
    let separator = args.separator;
    if (!!separator) context.separator = separator;
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

    let results = [];

    if (context.isPassword) {
        // START PASSWORD GENERATION
        function generatePassword(size) {
            let acc = '';
            const charlist =
                'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123456789!@#$%&*;:'.split(
                    ''
                );
            for (let i = 0; i < size; i++) {
                acc += charlist[randomInt(0, 81)];
            }
            return acc;
        }
        for (let i = 0; i < context.times; i++) {
            results.push(generatePassword(context.passlength));
        }
    } else {
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
    }

    console.log(results.join('\n'));
})();
