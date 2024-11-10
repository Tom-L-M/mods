const fs = require('node:fs');

/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.5.0
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @param {{ args, allowWithNoDash, allowMultiple }} options
 * - The "args" parameter allows for specifiying a custom array instead of process.argv.
 * - The "allowWithNoDash" allows for parameters without '--' or '-' to be considered.
 * - The "allowMultiple" parameter allows for repeated options to be added as an array.
 * - The "allowCasting" parameter allows for automatic casting, on matching values, as numbers.
 * - The "allowNegation" parameter allows for usage of negation prefix "-no-" or "--no-" to cast args as false.
 *   (When both allowNegation and allowMultiple options are true, and there is both a regula parameter AND its negated form
 *   they will both have its values added to the array, and the negated form will add 'false' as value).
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption> With allowWithNoDash = true (default) </caption>
 * // called the script with:
 * // node example.js build --param1 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // returns:  { build: true, param1: p2value, param3: 0000 }
 *
 * @example <caption> With allowWithNoDash = false </caption>
 * // called the script with:
 * // node example.js build --param1 pvalue -p 0000
 * parseArgv({ "p": "param3" }, { allowWithNoDash: false })
 * // returns:  { param1: p2value, param3: 0000 }
 * // The 'build' param is not considered, as it does not start with a dash
 */
const _parseArgv = (
    mapping = {},
    {
        allowWithNoDash = true,
        allowMultiple = false,
        allowNegation = false,
        allowCasting = false,
        args,
    } = {}
) => {
    const meta = { lastIndex: 0, count: 0 };
    const argv = args || process.argv.slice(2);
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        let temp, keyname;
        if (argv[i].startsWith('--')) {
            keyname = argv[i].slice(2);
            if (allowNegation && keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            } else {
                temp =
                    argv[i + 1]?.startsWith('-') || !argv[i + 1]
                        ? true
                        : argv[++i];
            }
        } else if (argv[i].startsWith('-')) {
            keyname = argv[i].slice(1);
            if (allowNegation && keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            } else {
                temp =
                    argv[i + 1]?.startsWith('-') || !argv[i + 1]
                        ? true
                        : argv[++i];
            }
        } else {
            if (allowWithNoDash) {
                keyname = argv[i];
                temp = true;
                if (allowNegation && keyname.startsWith('no-')) {
                    temp = false;
                }
            }
        }

        if (temp === null) continue;
        meta.count++;
        meta.lastIndex++;

        if (allowNegation) {
            if (keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            }
        }

        if (allowCasting) {
            const parsed = parseFloat(temp);
            if (!isNaN(parsed) && parsed.toString() === temp) {
                temp = parsed;
            }
        }

        if (allowMultiple && params[keyname] !== undefined) {
            if (Array.isArray(params[keyname])) {
                params[keyname].push(temp);
            } else {
                params[keyname] = [params[keyname], temp];
            }
        } else {
            params[keyname] = temp;
        }
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return { args: params, meta };
};

//
// This is an intermediate step before adding the breaking changed _parseARgv function
// the new one breaks old versions by returning a {"args":{}, "meta":{}} object instead of a plain object
// so this one keeps compatibility while not properly fixing all modules
//
const parseArgv = (
    mapping = {},
    {
        allowWithNoDash = true,
        allowMultiple = false,
        allowNegation = false,
        allowCasting = false,
        args,
    } = {}
) => {
    const argv = args || process.argv.slice(2);
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        let temp, keyname;
        if (argv[i].startsWith('--')) {
            keyname = argv[i].slice(2);
            if (allowNegation && keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            } else {
                temp =
                    argv[i + 1]?.startsWith('-') || !argv[i + 1]
                        ? true
                        : argv[++i];
            }
        } else if (argv[i].startsWith('-')) {
            keyname = argv[i].slice(1);
            if (allowNegation && keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            } else {
                temp =
                    argv[i + 1]?.startsWith('-') || !argv[i + 1]
                        ? true
                        : argv[++i];
            }
        } else {
            if (allowWithNoDash) {
                keyname = argv[i];
                temp = true;
                if (allowNegation && keyname.startsWith('no-')) {
                    temp = false;
                }
            }
        }

        if (temp === null) continue;

        if (allowNegation) {
            if (keyname.startsWith('no-')) {
                keyname = keyname.slice(3);
                temp = false;
            }
        }

        if (allowCasting) {
            const parsed = parseFloat(temp);
            if (!isNaN(parsed) && parsed.toString() === temp) {
                temp = parsed;
            }
        }

        if (allowMultiple && params[keyname] !== undefined) {
            if (Array.isArray(params[keyname])) {
                params[keyname].push(temp);
            } else {
                params[keyname] = [params[keyname], temp];
            }
        } else {
            params[keyname] = temp;
        }
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            return true;
        };

        stream.on('data', onData);
        stream.once('end', onEnd);
        stream.once('error', onError);
    });
}

function streamToSTDOUT(fname) {
    return new Promise((resolve, reject) => {
        try {
            const stream = fs.createReadStream(fname);
            stream.pipe(process.stdout);
            stream.on('end', resolve);
        } catch (err) {
            reject(err);
        }
    });
}

const isSTDINActive = () => !process.stdin.isTTY;

module.exports = {
    _parseArgv,
    parseArgv,
    streamToSTDOUT,
    isSTDINActive,
    readStdinAsync,
};
