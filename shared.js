/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 * @deprecated Use "ArgvParser" instead.
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
    const params = {};
    for (let i = 0; i < argv.length; i++) {
        let temp, keyname;
        if (argv[i] === '-') {
            // Special case used in STDIN-reading modules (like 'cat')
            keyname = '-';
            temp = true;
        } else if (argv[i].startsWith('--')) {
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

class ArgvParser {
    constructor() {
        this.registered = [];
        this.arguments = [];
    }

    #resolveOptionName(n) {
        let tmp = this.#getOptionFromNameOrAlias(n);
        if (tmp) return tmp;
        if (n.startsWith('no-')) {
            tmp = this.#getOptionFromNameOrAlias(n.slice(3));
            if (tmp?.allowNegation) return tmp;
        }
        return null;
    }
    #getOptionFromNameOrAlias(name) {
        return this.registered.filter(
            v => v?.name === name || v?.alias?.includes(name)
        )[0];
    }

    /**
     * Adds a option flag to the current parser
     * @param {string} name The option long name
     * @param {{
     *  alias: string|Array<string>,
     *  allowValue: boolean,
     *  allowMultiple: boolean,
     *  allowCasting: boolean,
     *  allowNegation: boolean
     * }} options A list of possible options for controlling the parser behaviour.
     *  - alias: a string or array of strings containing aliases for the flag - usually the short name.
     *    (E.g. 'p' for option 'port')
     *  - allowValue: Defaults to true. If set to true, expects a value for the flag. Else, considers it a boolean flag
     *    (E.g. '--help' is boolean - do not expect a value).
     *  - allowMultiple: Defaults to false. If set to true, multiple uses of the same flag will add as an array. Otherwise, the last use overrides the previous.
     *  - allowCasting: Defaults to false. If set to true, tries to convert the value as a number (if possible).
     *  - allowNegation: Defaults to false. If set to true, accepts the existance of a negated prefix and a corresponding boolean value of 'false'.
     *    (E.g. '--column' may accept a negated version: '--no-column').
     * @returns {ArgvParser}
     *
     * @example <caption> Define a simple '--help' flag: </caption>
     * // A 'help' flag with short name as 'h', that does not expect a value
     * argvparser.option('help', { alias: 'h', allowValue: false });
     *
     * @example <caption> Define a more complex '--port' flag: </caption>
     * // A 'port' flag, that can be called multiple times, and is casted to a number
     * argvparser.option('port', { alias: 'p', allowMultiple: true, allowCasting: true });
     *
     * @example <caption> Define a negate-able '--column' flag: </caption>
     * // A 'column' flag, that has multiple aliases, can be negated, and does not expect a value
     * argvparser.option('column', { alias: ['c', 'C'], allowValue: false, allowNegation: true });
     *
     */
    option(
        name,
        {
            alias = [],
            allowValue = true,
            allowMultiple = false,
            allowCasting = false,
            allowNegation = false,
            allowDash = false,
        } = {}
    ) {
        this.registered.push({
            name,
            alias: typeof alias === 'string' ? [alias] : alias,
            allowValue,
            allowMultiple,
            allowCasting,
            allowNegation,
            allowDash,
        });
        return this;
    }

    /**
     * Adds a positional argument to the current parser object.
     * @param {string} name
     * @param {{allowCasting: false}} options Configuration options
     *  - allowCasting: Defaults to false. If set to true, tries to convert the value as a number (if possible).
     * @returns {ArgvParser}
     * @example <caption> A URL positional argument: </caption>
     * // The first argument in argv that does not match any option flag, will be connected with this argument name:
     * argvparser.argument('url-target');
     * // A command line like: "curl -x post http://google.com.br/" will have
     * // the 'post' value set to flag 'x', and the URL set to the argument 'url-target'
     */
    argument(name, { allowCasting = false } = {}) {
        if (!name || typeof name !== 'string')
            throw new TypeError('Argument name must be a valid string');
        this.arguments.push({ name, allowCasting });
        return this;
    }

    /**
     * Parses a command line sequence using the configured options and arguments.
     * @param {Array<string>} args Optional. An array of strings to replace the default 'process.argv.slice(2)'.
     * @returns {object} Returns the parsed option flags and arguments as as object.
     * It also includes 3 special properties:
     *  - "_": string[].    A list of unused parameters (or anything that comes after '--').
     *  - "_invalid": string[].    A list of invalid flag tokens.
     * All other properties have as keys the respective defined option flag or argument.
     */
    parseArgv(args) {
        const isOption = (v, { allowDash = false } = {}) => {
            if (!v || (allowDash && v === '-')) return false;
            if (v.startsWith('-')) return true;
            return false;
        };

        const argv = args || process.argv.slice(2);

        const params = {};
        const rest = [];
        const unknown = [];

        // Defines a breaking point for when '--' is used
        // To prevent arguments after '--' of being parsed later
        let doubleDashIndex = process.argv.length;

        for (let i = 0; i < argv.length; i++) {
            let arg = argv[i];
            let next = argv[i + 1];
            let key, value, opt;

            // Special case 1:
            // Deliberately informs that there will be no more arguments after '--'
            if (arg === '--') {
                doubleDashIndex = rest.length;
                rest.push(...argv.slice(i + 1));
                break;
            }

            // Special case 2:
            // User informs the special '-' parameter
            if (arg === '-') {
                params['-'] = true; // Add as a token of usage (even if not selected as flag)
                rest.push('-'); // Add to 'rest' queue, for usage as positional parameter
                continue;
            }

            // For multi-char flags:
            //  --port 80 , and --port=80  should be the same
            //  Also, handle negative prefix ('--no-')
            if (arg.startsWith('--')) {
                arg = arg.slice(2);

                // For concatenated flag=value: --port=80
                if (arg.includes('=')) {
                    key = arg.slice(0, arg.indexOf('='));
                    value = arg.slice(arg.indexOf('=') + 1);
                    opt = this.#resolveOptionName(key);
                    if (!opt) {
                        unknown.push(key);
                        continue;
                    }
                }

                // For no value flags:  --port
                // And for negative flags:  --no-port
                // And for postvalue flags:  --port 80
                else {
                    key = arg;
                    opt = this.#resolveOptionName(key);
                    if (!opt) {
                        unknown.push(key);
                        continue;
                    }

                    if (opt?.allowValue) {
                        if (!isOption(next, { allowDash: opt?.allowDash })) {
                            value = next ? (i++, next) : '';
                        } else {
                            value = '';
                        }
                    } else {
                        value = true;
                    }

                    if (
                        arg.startsWith('no-') &&
                        opt?.allowNegation &&
                        !opt?.name.startsWith('no-') &&
                        typeof value === 'boolean'
                    ) {
                        key = arg.slice(4);
                        value = false;
                    } else {
                        key = arg;
                    }
                }

                // Cast as number
                if (opt?.allowCasting) {
                    const asfloat = parseFloat(value);
                    value = !isNaN(asfloat) ? asfloat : value;
                }

                // Convert to long name format
                key = opt?.name || key;

                if (opt?.allowMultiple) {
                    if (params[key] === undefined) params[key] = [value];
                    else params[key].push(value);
                } else {
                    params[opt?.name || key] = value;
                }

                continue;
            }

            // For single-char flags:
            //  -p 80 , -p80 , and -p=80 should be the same
            if (arg.startsWith('-')) {
                arg = arg.slice(1);
                key = arg[0];

                let opt = this.#resolveOptionName(key);

                // For concatenated value-less flags: -abc instead of -a -b -c
                //  First we need to expand the flags into their respective slots
                if (arg.length > 1 && arg[1] !== '=' && !opt?.allowValue) {
                    // If it is a multiple flag sequence: -abc
                    // insert the rest (bc) into process argv
                    argv[i] = '-' + arg.slice(0, 1);
                    argv.splice(i + 1, 0, '-' + arg.slice(1));
                    //  And then we reset the local variables to reflect the current option
                    arg = argv[i].slice(1);
                    key = arg[0];
                    //  After the above block, the current option is no more 'abc',
                    //  it is just 'a' and 'bc' was pushed as the next argument
                    opt = this.#resolveOptionName(key);
                }

                if (!opt) {
                    unknown.push(key);
                    continue;
                }

                // For no value flags:  -p
                // And for postvalue flags:  -p 80
                if (arg.length === 1) {
                    if (opt?.allowValue) {
                        if (!isOption(next, { allowDash: opt?.allowDash })) {
                            value = next ? (i++, next) : '';
                        } else {
                            value = '';
                        }
                    } else {
                        value = true;
                    }
                }

                // For concatenated flag=value: -p=80
                else if (arg[1] === '=') {
                    value = arg.slice(2);
                }

                // For concatenated flag+value: -p80
                else if (opt?.allowValue) {
                    value = arg.slice(1);
                }

                // Cast as number
                if (opt?.allowCasting) {
                    const asfloat = parseFloat(value);
                    value = !isNaN(asfloat) ? asfloat : value;
                }

                // Convert to long name format
                key = opt?.name || key;

                if (opt?.allowMultiple) {
                    if (params[key] === undefined) params[key] = [value];
                    else params[key].push(value);
                } else {
                    params[opt?.name || key] = value;
                }

                continue;
            }

            rest.push(arg);
            continue;
        }

        for (
            let i = 0;
            i < Math.min(this.arguments.length, doubleDashIndex);
            i++
        ) {
            let argument = this.arguments[i];
            let argval = rest.shift();
            if (argument.allowCasting) {
                // Cast as number
                const asfloat = parseFloat(argval);
                argval = !isNaN(asfloat) ? asfloat : argval;
                params[argument.name] = argval;
            }
            params[argument.name] = argval;
        }

        return { _: rest, _invalid: unknown, ...params };
    }
}

function parseControlChars(string) {
    return string
        .replaceAll('\\t', '\t')
        .replaceAll('\\n', '\n')
        .replaceAll('\\b', '\b')
        .replaceAll('\\r', '\r')
        .replaceAll('\\f', '\f')
        .replaceAll('\\0', '\0') // Parse literal NULL bytes (useful with C strings)
        .replaceAll(/\\x([a-f0-9]{1,2})/gi, (match, n1) =>
            String.fromCharCode(parseInt(n1, 16))
        );
}

function readStdinAsync({ controlChars = false } = {}) {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onError = err => quit() && reject(err);
        const onEnd = () =>
            quit() &&
            resolve(
                Buffer.from(
                    (controlChars ? parseControlChars : v => v)(
                        Buffer.concat(chunks).toString()
                    )
                )
            );

        const quit = () => {
            stream.removeListener('data', onData);
            return true;
        };

        stream.on('data', onData);
        stream.once('end', onEnd);
        stream.once('error', onError);
    });
}

const isSTDINActive = () => !process.stdin.isTTY;

class Logger {
    constructor({ stdout, format, colors = true } = {}) {
        this.stdout = stdout || process.stdout;
        this.colors = colors;
        if (format && typeof format === 'function') {
            this.formatter = format;
        } else {
            this.formatter = param => {
                return JSON.stringify(param);
            };
        }
    }

    #timestampGenerator() {
        return new Date().toISOString();
    }

    #colorize(color = '', string) {
        if (!this.colors) return string;
        const colors = { red: 31, green: 32, blue: 34, yellow: 33 };
        return `\x1b[0m\x1b[${colors[color] || ''}m${string}\x1b[0m`;
    }

    #log(level, props, message) {
        let result = {
            timestamp: this.#timestampGenerator(),
            level,
        };

        if (typeof message !== 'string') {
            message = JSON.stringify(message);
        }

        if (typeof props !== 'object') {
            props = { info: props };
        }

        for (let prop in props) {
            result[prop] = props[prop];
        }

        result.message = message || result.message;
        result = this.formatter(result);
        if (this.colors) {
            result = this.#colorize(
                level === 'info'
                    ? 'blue'
                    : level === 'warn'
                    ? 'yellow'
                    : level === 'error'
                    ? 'red'
                    : level === 'debug'
                    ? 'green'
                    : null,
                result
            );
        }
        return this.stdout.write(result + '\n');
    }

    disableColors() {
        this.colors = false;
        return this;
    }

    enableColors() {
        this.colors = true;
        return this;
    }

    info(props, message) {
        return this.#log('info', props, message);
    }

    error(props, message) {
        return this.#log('error', props, message);
    }

    warn(props, message) {
        return this.#log('warn', props, message);
    }

    debug(props, message) {
        return this.#log('debug', props, message);
    }

    /**
     * Paints a text with specified foreground and background colors.
     *
     * Colors can be passed in either string mode, numerical mode, or hex mode.
     *
     * The colors available in string mode are the ones supported by 8/16 color terminals:
     * black, red, green, yellow, blue, magenta, cyan, white, default
     *
     * The colors available in numerical mode are the supported by 8-bit color terminals:
     * https://user-images.githubusercontent.com/995050/47952855-ecb12480-df75-11e8-89d4-ac26c50e80b9.png
     *
     * Hex mode can be the short (#RGB) or long (#RRGGBB) ones.
     * The terminal must support TrueColor.
     *
     * @param {string|number} foreground
     * @param {string|number} background
     * @returns {string}
     */
    print(text, foreground = '', background = '') {
        if (!this.colors) return console.log(text);
        const CSI = '\x1b[';
        const RESET = CSI + '0m';
        const COLOR_TABLE_8BIT = {
            black: 0,
            red: 1,
            green: 2,
            yellow: 3,
            blue: 4,
            magenta: 5,
            cyan: 6,
            white: 7,
            default: 9,
        };
        const fromColorCode = (color, type) => {
            // For 8-bit colors
            if (COLOR_TABLE_8BIT[color] !== undefined)
                return `${CSI}${type === 'fg' ? '3' : '4'}${
                    COLOR_TABLE_8BIT[color]
                }m`;
            // For complete colors
            else if (typeof color === 'number')
                return `${CSI}${type === 'fg' ? '3' : '4'}8;5;${color}m`;
            // For TrueColor mode
            else if (color.startsWith('#')) {
                if (color.length === 4) {
                    // Short codes: #RGB
                    const c = [color[1], color[2], color[3]].map(v =>
                        parseInt(v, 16)
                    );
                    return `${CSI}${type === 'fg' ? '3' : '4'}8;2;${c[0]};${
                        c[1]
                    };${c[2]}m`;
                } else if (color.length === 7) {
                    // Long codes: #RRGGBB
                    const c = [
                        color.slice(1, 3),
                        color.slice(3, 5),
                        color.slice(5, 7),
                    ].map(v => parseInt(v, 16));
                    return `${CSI}${type === 'fg' ? '3' : '4'}8;2;${c[0]};${
                        c[1]
                    };${c[2]}m`;
                }
            } else return '';
        };
        return console.log(
            RESET +
                fromColorCode(foreground, 'fg') +
                fromColorCode(background, 'bg') +
                text +
                RESET
        );
    }
}

function prettifyRawRequestData(buffer) {
    const chunk = (array = [], chunkSize = 2, filler = undefined) => {
        let arr = [...array];
        if (filler !== undefined)
            arr.push(
                ...new Array(
                    array.length < chunkSize
                        ? chunkSize - array.length
                        : array.length % chunkSize
                ).fill(filler)
            ); // If a filler is set, fills a next part of chunk
        let acc = [];
        let tmp = [];
        for (let i = 0; i < arr.length; i++) {
            if (tmp.length < chunkSize) {
                tmp.push(arr[i]);
            }
            if (tmp.length === chunkSize || i === arr.length - 1) {
                acc.push(tmp);
                tmp = [];
            }
        }
        return acc;
    };
    const chunkedBuffer = chunk(buffer, 16);
    const chunkedString = chunk([...buffer.toString()], 16);
    return chunkedBuffer
        .map(
            (v, i) =>
                '  ' +
                v
                    .map(x =>
                        x
                            ? '0x' +
                              x.toString(16).padStart(2, '0').toUpperCase()
                            : '    '
                    )
                    .join(' ')
                    .padEnd(16 * 5, ' ') +
                ' |' +
                chunkedString[i].join('').padEnd(16, ' ') +
                '|'
        )
        .join('\n');
}

module.exports = {
    ArgvParser,
    parseArgv,
    isSTDINActive,
    readStdinAsync,
    parseControlChars,
    Logger,
    prettifyRawRequestData,
};
