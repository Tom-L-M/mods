const fs = require('node:fs');
const path = require('node:path');
const PROPS = require('./props.json');
const SKINS_DIR = path.join(__dirname, 'skins');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

const ERROR = {
    E_NO_SKIN_DIR: s => `Error: Invalid skins directory "${s}"`,
    E_NO_SKIN: s => `Error: Missing selected skin "${s}"`,
};

const tryf = f => {
    try {
        return f();
    } catch {
        return null;
    }
};

function listSkins() {
    return tryf(() => fs.readdirSync(SKINS_DIR));
}

function getExternalSkin(skin) {
    return tryf(() => fs.readFileSync(path.resolve(skin), 'utf-8'));
}

function getLocalSkin(skin) {
    return tryf(() => fs.readFileSync(path.join(SKINS_DIR, skin), 'utf8'));
}

function splitStringWithSpaces(inputString) {
    const result = [];
    let buffer = inputString[0]; // To accumulate words or spaces

    for (let i = 1; i < inputString.length; i++) {
        let char = inputString[i];
        if (char === ' ') {
            // If we encounter a space, check if buffer has a word
            if (buffer && buffer !== ' ') {
                result.push(buffer);
                buffer = '';
            }
            // Accumulate spaces
            buffer += char;
        } else {
            // If we encounter a non-space, check if buffer has spaces
            if (buffer.startsWith(' ')) {
                result.push(buffer);
                buffer = '';
            }
            // Accumulate non-space characters
            buffer += char;
        }
    }

    // Push the final buffer content, if any
    if (buffer) {
        result.push(buffer);
    }

    return result;
}

function foldStringIntoArray(input, width) {
    if (width < 1) throw new Error('Width must be at least 1');
    // If it has at least 1 newline, then it is multiline
    // and multiline strings need an initial blank space,
    // otherwise, they lose the original alignment
    if (input.indexOf('\n') >= 0) input = ' ' + input;
    // Turn newlines into words
    input = input.replaceAll(/\n/gi, ' \n ');
    // Remove all rewind chars '\r'
    input = input.replaceAll(/\r/gi, '');

    const words = splitStringWithSpaces(input);
    let lines = []; // To hold each line of the final output
    let currentLine = ''; // The current line being built

    for (let i = 0; i < words.length; i++) {
        let word = words[i];
        // Check if adding this word would exceed the width
        if ((currentLine + word).length > width || word.includes('\n')) {
            // Push the current line and reset it
            lines.push(currentLine);
            if (word.startsWith(' ')) word = word.slice(1);
            currentLine = word === '\n' ? '' : word; // Start a new line with the current word
        } else {
            // Otherwise, add the word to the current line
            currentLine += word;
        }
    }

    // Push the last line if it has any content
    if (currentLine.trim()) {
        lines.push(currentLine);
    }

    return lines.map(v => v.split('\n')).flat();
}

function justify(string, length) {
    // To center the string, instead of justifying, use this:
    // const pre = ' '.repeat(Math.floor((length - string.length) / 2));
    // const post = ' '.repeat(Math.ceil((length - string.length) / 2));
    // return pre + string + post;
    return string.padEnd(length);
}

function renderBalloon(
    string,
    { maxLength = 40, style = 'default', noWrap = false }
) {
    const lines = foldStringIntoArray(string, noWrap ? 10000 : maxLength);
    const longest = Math.max(...lines.map(v => v.length));
    const isMultiline = lines.length > 1;

    let roof, floor, endlines;

    if (style === 'default' || style === 'say') {
        roof = ' ' + '_'.repeat(longest + 2) + ' \n';
        floor = '\n ' + '-'.repeat(longest + 2) + ' ';
        if (isMultiline) {
            endlines = lines.map((v, i, a) => {
                if (i === 0) return '/ ' + justify(v, longest) + ' \\';
                if (i === a.length - 1)
                    return '\\ ' + justify(v, longest) + ' /';
                return '| ' + justify(v, longest) + ' |';
            });
        } else {
            endlines = lines.map(v => '< ' + justify(v, longest) + ' >');
        }
    }

    if (style === 'modern') {
        roof = '┌' + '─'.repeat(longest + 2) + '┐\n';
        floor = '\n└' + '─'.repeat(longest + 2) + '┘';
        endlines = lines.map(v => '│ ' + justify(v, longest) + ' │');
    }

    if (style === 'think' || style === 'dream') {
        roof = ' ' + '_'.repeat(longest + 2) + ' \n';
        floor = '\n ' + '-'.repeat(longest + 2) + ' ';
        endlines = lines.map(v => '( ' + justify(v, longest) + ' )');
    }

    if (style === 'box') {
        roof = '+' + '-'.repeat(longest + 2) + '+\n';
        floor = '\n+' + '-'.repeat(longest + 2) + '+';
        endlines = lines.map(v => '| ' + justify(v, longest) + ' |');
    }

    return roof + endlines.join('\n') + floor;
}

function renderSkin(
    skin,
    string,
    { prop, maxLength, eyes, tongue, style, noWrap } = {}
) {
    let skindata;

    const skinlist = listSkins();
    if (skinlist === null) return ERROR.E_NO_SKIN_DIR(SKINS_DIR);
    if (!skinlist.includes(skin)) skindata = getExternalSkin(skin);
    else skindata = getLocalSkin(skin);

    if (skindata === null) return ERROR.E_NO_SKIN(skin);

    const propdefault = PROPS['default'];
    const propdata =
        prop && typeof prop === 'string'
            ? PROPS[prop.toLowerCase()]
            : propdefault;
    const combined = { ...propdefault, ...propdata };
    let result = skindata;

    if (eyes && typeof eyes === 'string') {
        result = result.replaceAll('{$eye1}', eyes[0]);
        result = result.replaceAll('{$eye2}', eyes[1]);
    }

    if (tongue && typeof tongue === 'string') {
        result = result.replaceAll('{$tongue}', tongue);
    }

    if (style && style === 'think') {
        result = result
            .replaceAll(/\{\$tl\} /gim, '()')
            .replaceAll(/\{\$tr\} /gim, '()');
    }

    for (let key in combined) {
        result = result.replaceAll(`{$${key}}`, combined[key]);
    }

    result = result.replaceAll(
        '{$balloon}',
        renderBalloon(string, { maxLength, style, noWrap })
    );

    return result.trimEnd();
}

const help = `
    [cowsay-js]
        A "cowsay" command line utility in NodeJS.

    Usage:
        node cowsay [options] [string]
      OR
        <stdin> | node cowsay [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -l | --list             Do not print string, instead print skins available.
        -n | --no-wrap          Prevents line-wrapping (good for recursion).
        -W | --width N          Specifies width of the speech balloon (default: 40).
        -f | --file N           Specified a local or external skin name/file.
        -e | --eyes             Specifies a 2-chars-long string to use as the eyes.
        -T | --tongue           Specifies a 2-chars-long string to use as the tongue.

      Balloon Style:
        -M | --modern           Uses modern box-building ASCII chars.
        -B | --box              Uses regular box-building ASCII chars.
        -D | --dream | --think  Uses a "thinking" balloon (round walls).

      Cow Style:
        -b | --borg             "Borg mode", uses '==' for the eyes.
        -d | --dead             "Dead", uses 'XX' for the eyes, plus a 'U' tongue.
        -g | --greedy           "Greedy", uses '$$' for the eyes.
        -p | --paranoid         "Paranoid", uses '@@' for the eyes.
        -s | --stoned           "Stoned", uses '**' for the eyes, plus a 'U' tongue.
        -t | --tired            "Tired", uses '--' for the eyes.
        -w | --wired            "Wired", uses 'OO' for the eyes.
        -y | --youthful         "Youthful", uses '..' for smaller eyes.

    Examples:
        STDIN reading with the Tux skin:
            echo hello | node cowsay -f tux

        Using an extenal custom skin file:
            node cowsay -f ../some/skin.txt "something to say"`;

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('list', { alias: 'l', allowValue: false });
    parser.option('no-wrap', { alias: 'n', allowValue: false });
    parser.option('width', { alias: 'w', allowCasting: true });
    parser.option('file', { alias: 'f' });
    parser.option('eyes', { alias: 'e' });
    parser.option('tongue', { alias: 'T' });

    parser.option('borg', { alias: 'b', allowValue: false });
    parser.option('dead', { alias: 'd', allowValue: false });
    parser.option('greedy', { alias: 'g', allowValue: false });
    parser.option('paranoid', { alias: 'p', allowValue: false });
    parser.option('stoned', { alias: 's', allowValue: false });
    parser.option('tired', { alias: 't', allowValue: false });
    parser.option('wired', { alias: 'w', allowValue: false });
    parser.option('youthful', { alias: 'y', allowValue: false });

    parser.option('modern', { alias: 'M', allowValue: false });
    parser.option('box', { alias: 'B', allowValue: false });
    parser.option('think', { alias: ['D', 'dream'], allowValue: false });

    parser.argument('string');

    const args = parser.parseArgv();

    if (args.help || (!fromSTDIN && !args.string && !args.list))
        return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    const input = fromSTDIN
        ? (await readStdinAsync()).toString('utf8').trimEnd()
        : args.string || '';

    const skin = args.file || 'cow';
    const listing = Boolean(args.list);

    const prop = args.borg
        ? 'borg'
        : args.dead
        ? 'dead'
        : args.greedy
        ? 'greedy'
        : args.paranoid
        ? 'paranoid'
        : args.stoned
        ? 'stoned'
        : args.tired
        ? 'tired'
        : args.wired
        ? 'wired'
        : args.youthful
        ? 'youthful'
        : 'default';

    const style = args.modern
        ? 'modern'
        : args.think
        ? 'think'
        : args.box
        ? 'box'
        : 'default';

    if (listing)
        return console.log(
            foldStringIntoArray(listSkins().join(' '), 80).join('\n')
        );

    console.log(
        renderSkin(skin, input, {
            noWrap: args['no-wrap'],
            maxLength: args.width,
            eyes: args.eyes,
            tongue: args.tongue,
            prop,
            style,
        })
    );
})();
