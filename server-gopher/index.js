const buffer = require('node:buffer');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs');

const utils = {
    localIP: function () {
        return Object.values(require('node:os').networkInterfaces())
            .flat()
            .filter(({ family, internal }) => family === 'IPv4' && !internal)[0]
            .address;
    },
    isDirectory: function (filepath) {
        return fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory();
    },
    walkDirs: (p = '.') => {
        const listDirsSync = dir => {
            try {
                return [].concat(
                    dir,
                    ...fs
                        .readdirSync(dir, { withFileTypes: true })
                        .map(d =>
                            d.isDirectory()
                                ? listDirsSync(path.join(dir, d.name))
                                : []
                        )
                );
            } catch (err) {
                console.log(err);
                console.log('Error: Operation not permitted - SCANDIR::' + dir);
                console.log(
                    'Warn: Select a directory with proper enumeration/scan/traversal permissions'
                );
                process.exit();
            }
        };
        return listDirsSync(path.resolve(p)); //.sort().slice(1);
    },
};

const KNOWN_TEXT_EXTENSIONS = [
    'txt',
    'info',
    'log',
    'js',
    'css',
    'html',
    '',
    '',
    '',
    '',
    '',
    '',
];

async function build() {
    const readline = require('node:readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    const question = q => {
        return new Promise((res, rej) => rl.question(q, res));
    };

    const baseline_prompt = '\n ┌─ ';
    const nextline_prompt = '\n └─> ';
    let host = utils.localIP();
    let port = 70;
    const entries = [''];
    const addItem = async () => {
        console.clear();
        console.log(`
        Canonical types
            0	Text file
            1	Gopher submenu
            2	CCSO Nameserver
            3	Error code returned by a server to indicate failure
            4	Macintosh file (BinHex-encoded: .hqx)
            5	DOS file (.MZ or .COM)
            6	uuencoded file
            7	Gopher full-text search
            8	Telnet
            9	Binary file
            +	Mirror or alternate server (for load balancing or in case of primary server downtime)
            g	GIF file
            I	Image file
            T	Telnet (3270)
        Non-canonical types
            i	Informational message (widely used).
            d	Doc. Used alongside PDF's and .DOC's
            h	HTML file
            p	image file (especially the png format)
            r	document rtf file ("rich text Format")
            s	Sound file (especially the WAV format)	
            P	document pdf file ("Portable Document Format")	
            X	document xml file ("eXtensive Markup Language" )
        
        `);
        let itemtype = await question(
            baseline_prompt + 'What is the entry type?' + nextline_prompt
        );
        let itemdesc = await question(
            baseline_prompt + 'What is the description?' + nextline_prompt
        );
        let itempath = await question(
            baseline_prompt + 'What is the file path?' + nextline_prompt
        );
        let itemaddr =
            (await question(
                baseline_prompt +
                    `Associate to an IP address: (skip for ${host})` +
                    nextline_prompt
            )) || host;
        let itemport =
            (await question(
                baseline_prompt +
                    `Associate to a port: (skip for ${port})` +
                    nextline_prompt
            )) || port;
        let collection = `${itemtype}${itemdesc}\t${itempath}\t${itemaddr}\t${itemport}`;
        entries.push(collection);
        console.log(`\n<> Added [${collection}] to the entry collection\n`);
    };

    console.log('[gophermap-builder-js]');
    await question(
        `<> Welcome to the interactive gophermap builder. \n ┌─ Press 'ENTER' to start. \n ├─ Use 'CTRL+C' to quit at any time.` +
            nextline_prompt
    );
    console.clear();
    host =
        (await question(
            baseline_prompt +
                `Configure a default host IP: (skip for ${host} or use '{{HOST}}' for runtime config)` +
                nextline_prompt
        )) || host;
    port =
        (await question(
            baseline_prompt +
                `Configure a default port: (skip for ${port} or use '{{PORT}}' for runtime config)` +
                nextline_prompt
        )) || port;

    while (true) {
        let shouldAskMore = await question(
            baseline_prompt + 'Want to add an item? [y/n]' + nextline_prompt
        );
        while (shouldAskMore !== 'y' && shouldAskMore !== 'n') {
            shouldAskMore = await question(
                baseline_prompt + 'Want to add an item? [y/n]' + nextline_prompt
            );
        }
        if (shouldAskMore === 'y') await addItem();
        else break;
    }

    async function tryToSave(p) {
        let fullpath = path.resolve(p, 'gophermap');
        let content = entries.join('\r\n');
        try {
            fs.writeFileSync(fullpath, content);
            console.log(
                `\n<> Success, gophermap file saved to [${fullpath}] - Saved ${content.length} bytes on disk.`
            );
            rl.close();
            return;
        } catch (err) {
            console.log(
                '\n<> Error, could not save gophermap file to [' +
                    fullpath +
                    ']'
            );
            let shouldAskMore = '';
            while (shouldAskMore !== 'y' && shouldAskMore !== 'n') {
                shouldAskMore = await question(
                    baseline_prompt +
                        'Want to use another save directory? [y/n]' +
                        nextline_prompt
                );
            }
            if (shouldAskMore === 'y') {
                fullpath =
                    (await question(
                        baseline_prompt +
                            `In which directory should the gophermap be saved?` +
                            nextline_prompt
                    )) || fullpath;
                console.clear();
                return await tryToSave(fullpath);
            } else return;
        }
    }

    let location = process.cwd();
    console.clear();
    location =
        (await question(
            baseline_prompt +
                `In which directory should the gophermap be saved? (skip for ${location})` +
                nextline_prompt
        )) || location;
    await tryToSave(location);
}

class GopherServer {
    constructor(dir, host, port) {
        this.dir = path.resolve(dir || process.cwd()); // absolute path
        this.rdir = dir || process.cwd(); // relative path
        this.host = host || utils.localIP();
        this.port = port || 70;
        this.cache = this.#gatherGopherMaps();
        this.server;
        this.responses = {
            content_not_found: function () {
                return '3No Content Found';
            },
            data_not_found: function (url) {
                return `3"${url}" not found`;
            },
        };
    }

    #getGophermap(dir) {
        const gophermap = dir + '\\gophermap';
        if (!fs.existsSync(gophermap)) return null;
        return fs
            .readFileSync(gophermap, 'utf-8')
            .replace(/{{HOST}}/gim, this.host)
            .replace(/{{PORT}}/gim, this.port)
            .replace(/\\\t/gim, '\t');
    }

    #makeGophermap(dir) {
        // Lists dir contents and create a virtual gophermap
        if (!utils.isDirectory(dir)) return '';
        let files = fs.readdirSync(dir, { withFileTypes: true });
        let lines = [];

        const addEntry = (type, item, host = this.host, port = this.port) => {
            let itemdesc = item;
            let itempath = path
                .resolve(dir, itemdesc)
                .replace(this.dir, '')
                .replace(/\\/gim, '/');
            lines.push(`${type}${itemdesc}\t${itempath}\t${host}\t${port}`);
        };

        const addInfoEntry = file => {
            fs.readFileSync(path.join(dir, file), 'utf-8')
                .split('\n')
                .forEach(line => {
                    lines.push(`i${line.trim()}\t\terror.host\t1`);
                });
        };

        for (let dirent of files) {
            let item = dirent.name;
            if (dirent.isDirectory()) {
                addEntry('1', item);
                continue;
            }
            let extension = item.split('.').reverse()[0];
            switch (extension) {
                case 'info':
                case 'log':
                    addInfoEntry(item);
                    break;
                case 'txt':
                    addEntry('0', item);
                    break;
                case 'hqx':
                    addEntry('4', item);
                    break;
                case 'gif':
                    addEntry('g', item);
                    break;
                case 'png':
                case 'jpg':
                    addEntry('I', item);
                    break;
                case 'wav':
                    addEntry('s', item);
                    break;
                case 'com':
                case 'mz':
                    addEntry('5', item);
                    break;
                default:
                    // If file is binary add a '9' menu, else, add a '0' menu (text file)
                    let result = fs.readFileSync(path.join(dir, item));
                    if (!!buffer.isAscii && !!buffer.isUtf8) {
                        if (buffer.isAscii(result) || buffer.isUtf8(result))
                            addEntry('0', item);
                        else addEntry('9', item);
                    } else {
                        // If Node.js V19.6 or higher is not available, use extensions:
                        if (KNOWN_TEXT_EXTENSIONS.includes(extension))
                            addEntry('0', item);
                        else addEntry('9', item);
                    }
            }
        }
        return lines.join('\r\n');
    }

    #gatherGopherMaps() {
        // Traverse directories searching for gophermap files
        // For every directory (recursive):
        // If a gopher map file exists: read the gophermap file, and return matches to the searched value
        // If a gopher map file does not exist: generate a gophermap in memory and return matches to the searched value
        let dirs = utils.walkDirs(this.dir);
        let collection = {};
        for (let dir of dirs) {
            collection[dir] =
                this.#getGophermap(dir) || this.#makeGophermap(dir);
        }
        return collection;
    }

    #fetchSearchData(url) {
        let keyword = url.split('\t')[1];
        let matches = [];
        // Search for contents indexed in the gophermaps cache
        for (let item in this.cache) {
            let lines = this.cache[item].split('\n');
            for (let line of lines) {
                let searcheable = line.split('\t')[0];
                let regex = new RegExp(keyword, 'im');
                if (searcheable.match(regex) && !searcheable.startsWith('i'))
                    matches.push(line);
            }
        }
        return matches.join('\n');
    }

    #fetchDocumentData(url) {
        // If the selector does not match any known document, return an error message
        let result = null;
        if (fs.existsSync(url)) {
            result = fs.readFileSync(url);

            // Checks if node.js version is over 19.6, to use these two methods:
            if (!!buffer.isAscii && !!buffer.isUtf8) {
                if (buffer.isAscii(result) || buffer.isUtf8(result))
                    result = result.toString('utf-8');
            }

            // If Node.js V19.6 or higher is not available, use extensions:
            else {
                let extension = url.slice(url.lastIndexOf('.') + 1);
                if (KNOWN_TEXT_EXTENSIONS.includes(extension))
                    result = result.toString('utf-8');
            }
        }
        return result;
    }

    #fetchFromCache(url) {
        return this.cache[url] || null;
    }

    #gopherProtoHandler(data) {
        const url = path.join(this.dir, data);

        // Getting directories
        // Query is '', or ends with '/' or is directed to a dir
        if (data === '' || data.endsWith('/') || utils.isDirectory(url)) {
            return (
                this.#fetchFromCache(url) || this.responses.content_not_found()
            );
        }

        // Searching for content
        // Query includes a '\t'
        else if (data.includes('\t')) {
            return (
                this.#fetchSearchData(url) ||
                this.responses.data_not_found(data)
            );
        }

        // Getting documents
        // Regular queries
        else {
            return (
                this.#fetchDocumentData(url) ||
                this.responses.data_not_found(data)
            );
        }
    }

    #log(socket, msg) {
        console.log(
            `${new Date().toISOString()} - tcp@${socket.remoteAddress}:${
                socket.remotePort
            } <-> tcp@${this.host}:${this.port} - ${msg}`
        );
    }

    start() {
        return (this.server = net
            .createServer(socket => {
                this.#log(socket, 'Client_Connected');
                socket.on('close', () =>
                    this.#log(socket, 'Client_Disconnected')
                );
                socket.on('error', () => this.#log(socket, 'Connection_Error'));
                socket.on('data', data => {
                    let parsed = data.toString().trim(); // remove trailing stuff
                    this.#log(
                        socket,
                        `Data_Received (${data.length} bytes): ${parsed}`
                    );

                    let response = this.#gopherProtoHandler(parsed);
                    socket.write(response + '\r\n.\r\n');
                    // adds the final '\r\n' and the fullstop '.\r\n' for protocol compliance

                    this.#log(
                        socket,
                        'Data_Sent (' + response.length + ' bytes)'
                    );
                    socket.end();
                });
            })
            .listen(this.port, this.host, () => {
                console.log('Tip: use --help to access the help menu.');
                console.log(
                    `TCP Gopher server running on [gopher://${this.host}:${this.port}/], serving [${this.dir}]`
                );
            }));
    }
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('server-gopher/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(async function main() {
    // Info: the default IP is not 0.0.0.0, it is the base interface (192.168...)
    // it is this way, to avoid redirection problems when writing the gophermap file,
    // Do not use 0.0.0.0 as interface, unless the gophermap is totally configured
    // You can use '{{HOST}}' and '{{PORT}}' in the gophermap, in order to auto-replace addresses

    let port;
    let host;
    let dir;

    const args = process.argv.slice(2);

    const help = `
        [server-gopher-js]
            A protocol-compliant GOPHER server

        Usage:
            server-gopher [--build] [--help] [--version] [--host HOST] [--port PORT] [--dir DIR]

        Info:
            > Use '--build' to enter the gophermap builder before booting the server
            > Default host is the first local IPv4 interface (not 0.0.0.0)
            > Default port is 70, and default port for development usually is 7070
            > Default dir is the CWD (current working directory)

        Warn:
            > Using '0.0.0.0' as host without totally configured gophermaps
              will NOT work, as the gophermap interface would be set to 0.0.0.0
              which is local for the client machine
        
        Gophermap configuring:
            > Use '{{HOST}}' in a gophermap to parse it at runtime with the 
              current IP address
            > Use '{{PORT}}' in a gophermap to parse it at runtime with the 
              current server port
            > When serving a directory that does not include a 'gophermap', 
              one will be created at runtime, with the filename as description
              and the current host and port of the server included.
            > All gophermaps, phisical or virtual, will be cached in-memory 
              at server boot, for faster resource listing. So, highly deep 
              directories may slow down server boot.`;

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        let next = args[i + 1];
        switch (arg) {
            case '--help':
            case '-h':
                console.log(help);
                return;
            case '--version':
            case '-v':
                printVersion();
                return;
            case '--port':
            case '-p':
                port = next;
                break;
            case '--host':
            case '-o':
                host = next;
                break;
            case '--dir':
            case '-d':
                dir = next;
                break;
            case '--build':
            case '-b':
                await build();
                break;
        }
    }

    new GopherServer(dir, host, port).start();
})();
