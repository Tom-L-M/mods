const dgram = require('dgram');
const path = require('path');
const fs = require('fs');

const TOKEN_FOR_LISTING = 'list';

function getFileListing(directory) {
    function walk(dir) {
        var results = [];
        var list = fs.readdirSync(dir);
        list.forEach(function (file) {
            file = path.join(dir, file);
            var stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                /* Recurse into a subdirectory */
                results = results.concat(walk(file));
            } else {
                /* Is a file */
                results.push(file.replace(directory, '').slice(1));
            }
        });
        return results;
    }
    return walk(directory);
}

function startTftpServer(context) {
    const basedir = context.content;
    const app = {};
    app.udpserver = dgram.createSocket('udp4', function (data, rinfo) {
        const uniq_id = 'TFTP:' + rinfo.address;
        const logevent = msg =>
            console.log(
                `${new Date().toISOString()} - udp@${rinfo.address}:${
                    rinfo.port
                } - ${msg}`
            );

        const sendack = blocknum => {
            let buf = Buffer.from([0, 4, 0, 0]);
            buf.writeUInt16BE(blocknum, 2);
            app.udpserver.send(buf, rinfo.port, rinfo.address, (err, bytes) => {
                if (err) return logevent(`Error sending ACK packet: ${err}`);
            });
            // logevent(`ACK BLOCK ${blocknum}`);
        };

        const senderr = errcode => {
            let msg;
            switch (errcode) {
                case 1:
                    msg = 'ERR_FILE_NOT_FOUND';
                    break;
                case 2:
                    msg = 'ERR_ACCESS_VIOLATION';
                    break;
                case 3:
                    msg = 'ERR_ALLOC_EXCEEDED';
                    break;
                case 4:
                    msg = 'ERR_ILLEGAL_OPERATION';
                    break;
                case 5:
                    msg = 'ERR_UNKNOWN_TRANSFER_ID';
                    break;
                case 6:
                    msg = 'ERR_FILE_EXISTS';
                    break;
                case 7:
                    msg = 'ERR_NO_SUCH_USER';
                    break;
                default:
                    errcode = 0;
                    msg = 'ERR_NOT_DEFINED';
                    break;
            }
            let buf = Buffer.from([
                0,
                5, // ERR data packet identifier (05)
                0,
                0, // Error code
                ...[...Buffer.from(msg)], // The human-like error message
                0, // A null-byte terminator
            ]);
            buf.writeUInt16BE(errcode, 2);
            app.udpserver.send(buf, rinfo.port, rinfo.address, (err, bytes) => {
                if (err) return logevent(`Error sending ACK packet: ${err}`);
            });
            logevent(`TFTP_ERROR (${errcode}): ${msg}`);
        };

        let msg = data;
        const opcode = msg.readUInt16BE(0);

        if (opcode === 1) {
            // RRQ requests (read from server)
            let filename = msg.subarray(2, msg.indexOf(0, 2)).toString();
            const mode = msg
                .subarray(
                    msg.indexOf(0, 2) + 1,
                    msg.indexOf(0, msg.indexOf(0, 2) + 1)
                )
                .toString();

            try {
                let datastream, blockcount, size;

                if (filename === TOKEN_FOR_LISTING) {
                    datastream = getFileListing(basedir);
                    datastream = Buffer.from(datastream.join('\n'));
                    size = datastream.length;
                    filename = 'Content-List';
                    logevent(
                        `REQUESTED [Content-List] IN MODE [${mode}] - [${size} bytes] IN [${Math.ceil(
                            size / 516
                        )} packets]`
                    );
                    logevent(`<READ> TRANSFERENCE STARTED [Content-List]`);
                } else {
                    const ffpath = path.resolve(basedir, filename);
                    if (!ffpath.includes(path.resolve(basedir))) {
                        senderr(2);
                        return;
                    }
                    datastream = fs.readFileSync(ffpath);
                    size = datastream.length;
                    logevent(
                        `<REQUEST> GET [${filename}] IN MODE [${mode}] - [${size} bytes] IN [${Math.ceil(
                            size / 516
                        )} packets]`
                    );
                    logevent(`<READ> TRANSFERENCE STARTED [${filename}]`);
                }

                blockcount = 0;
                const sendpacket = offset => {
                    let packet = Buffer.concat([
                        Buffer.from([0, 3]), // DATA packets have opcode == 03
                        Buffer.from([0, 0]),
                        Buffer.from(datastream.slice(offset, offset + 512)),
                    ]);
                    packet.writeUInt16BE(++blockcount, 2); // blocknumber starts at 00 and keeps increasing
                    app.udpserver.send(
                        Buffer.from(packet),
                        rinfo.port,
                        rinfo.address,
                        (err, bytes) => {
                            // logevent(packet.length);
                            if (err)
                                return logevent(
                                    `Error sending data packet: ${err}`
                                );
                            if (packet.length >= 512) {
                                // Send next packet
                                setTimeout(() => sendpacket(offset + 512), 100); // Delay for 100ms to avoid packet loss
                            } else {
                                logevent(
                                    `<READ> TRANSFERENCE ENDED [${filename}] - [${size} bytes]`
                                );
                            }
                        }
                    );
                    // logevent(`ACK BLOCK ${blockcount}`);
                };
                sendpacket(0);
            } catch (err) {
                senderr(1);
                return logevent(`Error reading file ${filename}: ${err}`);
            }
        } else if (opcode === 2) {
            // WRQ requests (write to server)
            const filename = msg.subarray(2, msg.indexOf(0, 2)).toString();
            const mode = msg
                .subarray(
                    msg.indexOf(0, 2) + 1,
                    msg.indexOf(0, msg.indexOf(0, 2) + 1)
                )
                .toString();
            logevent(`<SUBMIT> PUT [${filename}] IN MODE [${mode}]`);
            context.EXTERNAL[uniq_id] = {
                _filename: filename,
                _mode: mode,
                _data: [],
                _lastblock: 0,
            };
            logevent(`<WRITE> TRANSFERENCE STARTED [${filename}]`);
            sendack(0);
        } else if (opcode === 3) {
            // DATA packets
            const blocknum = [...msg.subarray(2, 4)].reduce(
                (z, x, i) => (z += x)
            );
            const fdata = msg.subarray(4);
            const opts = context.EXTERNAL[uniq_id];
            // logevent('Received '+(data.length)+' bytes ('+fdata.length+' data bytes)');
            opts._lastblock += 1;

            //TODO fix this access permission thing

            if (
                (path.isAbsolute(opts._filename) &&
                    !opts._filename.includes(basedir)) ||
                (!path.isAbsolute(opts._filename) &&
                    opts._filename.includes('..'))
            ) {
                senderr(2);
                return;
            }

            const writedata = () => {
                fs.writeFileSync(
                    path.resolve(basedir, opts._filename),
                    Buffer.concat(opts._data)
                );
                sendack(blocknum);
                logevent(
                    `<WRITE> TRANSFERENCE ENDED [${opts._filename}] - [${opts._data.length} bytes]`
                );
            };

            // Handle packets smaller than 512 bytes:
            if (blocknum == 1 && fdata.length !== 512) {
                opts._data.push(fdata);
                sendack(blocknum);
                writedata();
            }

            // Handle packets longer than 512 bytes
            else if (blocknum == 1 || fdata.length == 512) {
                opts._data.push(fdata);
                sendack(blocknum);
            }

            // Write data to file when transference ends
            else {
                writedata();
            }
        } else if (opcode === 4) {
            // ACK packets
            // ACK packets should be better implemented, but, anyway, its working the way it is now
            // :/
        } else if (opcode === 5) {
            // ERROR packets
            const errcode = [...msg.subarray(2, 4)]
                .reduce((z, x, i) => (z += x))
                .toString();
            const errmsg = msg.subarray(4).toString();
            logevent(`ERROR (${errcode}): ${errmsg}`);
            sendack(0);
        } else {
            //senderr(5); // send an UNKNOWN ERROR ID error
        }
    });
    console.log(
        '>> Automatic config used. Use --help to access the help menu.'
    );
    console.log(
        '>> TFTP server running on udp://' +
            context.host +
            ':' +
            context.port +
            ', serving: ' +
            context.content
    );
    console.log(
        `>> Request the file "${TOKEN_FOR_LISTING}" to receive a listing of all available files`
    );
    app.udpserver.bind(context.port, context.host);
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('server-tftp/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(function wrapper() {
    const args = process.argv.slice(2);
    const help = `
    [server-tftp-js]
        A tool for creating and running a TFTP server

    Usage:
        server-tftp [--port PORT] [--host HOST] [--dir DIR]

    Options:
        --help    | -h  : Shows this help menu
        --version | -v  : Shows version information
        --port    | -p  : Selects a port to use (default is 69)
        --host    | -o  : Selects an interface to use (default is '0.0.0.0')
        --dir     | -d  : Responds requests with the contents of a dir`;

    const context = {
        args: args,
        help: help,
        host: '0.0.0.0',
        protocol: (args[0] || '').toLowerCase(),
        port: null,
        content: null,
        // Creates an external namespace, for data
        // that must be kept higher than socket-scope
        EXTERNAL: {},
    };

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        let next = args[++i];

        switch (arg) {
            case '-h':
            case '--help':
                return console.log(help);

            case '-v':
            case '--version':
                return printVersion();

            case '-o':
            case '--host':
                context.host = next;
                break;

            case '-p':
            case '--port':
                context.port = next;
                break;

            case '-d':
            case '--dir':
                context.content = next;
                break;

            default:
        }
    }

    try {
        if (!context.port) context.port = 69;
        if (!context.content) context.content = process.cwd();
        startTftpServer(context);
    } catch (err) {
        console.log(err.message);
    }
})();
