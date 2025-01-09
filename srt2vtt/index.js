const fs = require('node:fs');
const {
    ArgvParser,
    isStdinActive,
    readStdin,
    attempt,
    validateFile,
} = require('../shared');

const help = `
    [srt2vtt-js]
        A command line utility for converting subtitles format in NodeJS.

    Usage:
        node srt2vtt [options] [file]
      OR
        <stdin> | node srt2vtt [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -r | --vtt2srt          Converts from WEBVTT to SRT instead.
        -o | --output <FILE>    Saves the converted data to a file.
                                set <FILE> to "-" to output to stdout.`;

function convertSRTtoVTT(sourceData) {
    const srtBuffer = sourceData;
    const lines = srtBuffer.split('\n');
    const vttBuffer = ['WEBVTT', '']; // Add the "WEBVTT" signature at the top
    for (let line of lines) {
        line = line.trim();
        if (line[2] === ':' && line[5] === ':') {
            line = line.replaceAll(',', '.');
        }
        vttBuffer.push(line);
    }
    return vttBuffer.join('\n');
}

function convertVTTtoSRT(sourceData) {
    const vttBuffer = sourceData;
    const lines = vttBuffer.trimStart().split('\n').slice(1); // Remove the "WEBVTT" signature at the top
    const srtBuffer = [''];
    for (let line of lines) {
        line = line.trim();
        if (line[2] === ':' && line[5] === ':') {
            line = line.replaceAll('.', ',');
        }
        srtBuffer.push(line);
    }
    return srtBuffer.join('\n').trimStart();
}

(async function () {
    const fromSTDIN = isStdinActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('vtt2srt', { alias: 'r', allowValue: false });
    parser.option('output', { alias: 'o', allowDash: true });
    parser.argument('source');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.source)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    console.log(args);

    const [sourceCheckErr] = validateFile(args.source);
    if (args.source && sourceCheckErr) {
        return console.log(
            `Error: Invalid file provided as source (${args.source}) - ${sourceCheckErr.message}`
        );
    }

    const [outputCheckErr] = validateFile(args.output, {
        throwOnMissing: false,
    });
    if (args.output && args.output !== '-' && outputCheckErr) {
        return console.log(
            `Error: Invalid file provided as output destination (${args.output}) - ${outputCheckErr.message}`
        );
    }

    let sourcedata = null;
    if (fromSTDIN) {
        sourcedata = await readStdin({ encoding: 'utf-8' });
    } else {
        const [err, data] = attempt(() => fs.readFileSync(args.source, 'utf8'));
        if (err) {
            return console.log(
                `Error: Invalid file provided as source (${args.source}) - ${err.message}`
            );
        }
        sourcedata = data;
    }

    let result = null;
    if (args.vtt2srt) {
        result = convertVTTtoSRT(sourcedata);
    } else {
        result = convertSRTtoVTT(sourcedata);
    }

    if (args.output === '-' || !args.output) {
        return console.log(result);
    } else {
        const [err] = attempt(() => fs.writeFileSync(args.output, result));
        if (err) {
            return console.log(
                `Error: Invalid file provided as output destination (${args.output}) - ${err.message}`
            );
        }
    }
})();
