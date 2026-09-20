import { spawn } from "child_process";
import path, { join } from "path";
import { readdirSync } from "fs";

process.stdin.setRawMode(true);
process.stdout.write('\x1B[?1049h'); // switch to alternate screen buffer
process.stdout.write('\x1B[?25l');   // hide cursor

const songDir = readdirSync(join(process.cwd(), 'songs'), {
    encoding: 'utf8',
});


/**
    let input = ''; since chunk is immediateky transfered => no need of this    
 */
const allSongs = songDir.filter(fileName => {
    return fileName.endsWith('.mp3') ? true : false
})


let player = null;
let paused = false;

let startTime = 0;
let pausedAt = 0;
let totalPausedTime = 0;
let seekBarInterval = null;

let currentSongIndex = 0;
let manualSwitch = false;
let currentTimeElapsed = 0;
let currentDuration = 0;
let playingSongIndex = -1;


function buildMenu() {
    process.stdout.write('\x1B[H');  // move cursor to home (top-left)
    process.stdout.write('\x1B[J');  // clear from cursor to end of screen

    allSongs.forEach((song, index) => {
        if(currentSongIndex === index) {
            console.log(` > ${song}`);
        } else {
            console.log(`${song}`);
        }
    })

    // Redraw seek bar at fixed position if a song is playing
    if(player && currentDuration > 0) {
        drawSeekBar(currentTimeElapsed, currentDuration);
    }
}

async function playSong() {
    if(player) {
        clearInterval(seekBarInterval);
        seekBarInterval = null;
        paused = false;
        startTime = 0;
        pausedAt = 0;
        totalPausedTime = 0;
        manualSwitch = true;
        player.kill();
        player = null;
    }

    // Reset seek bar state
    currentTimeElapsed = 0;
    currentDuration = 0;
    playingSongIndex = currentSongIndex;

    
    try {
        const songPath = join(process.cwd(), 'songs', allSongs[currentSongIndex]);

        const { duration } = await getSongInfo(songPath);

        const childProcess = spawn('vlc', [songPath, '--intf', 'rc', '--play-and-exit'], {
            stdio: 'pipe',
        });

        // vlc process started
        childProcess.on('spawn', () => {
            startTime = Date.now();
            currentDuration = duration;
            seekBar(duration);
        })

        childProcess.on('close', (code, singal) => {
            if(manualSwitch) {
                manualSwitch = false;
                return;
            }
            // Prevent infinite respawn - only auto-advance if process lived > 1 second
            const lived = Date.now() - startTime;
            if(startTime > 0 && lived < 1000) {
                return;
            }
            // auto advancement
            currentSongIndex = (currentSongIndex + 1) % allSongs.length;
            buildMenu();
            playSong()
        })

        player = childProcess;

    } catch(e) {
        console.log(`Music Duration does not extracted, so music can't be played.`)
    }
}

function getSongInfo(songPath) {
    return new Promise((resolve, reject) => {
        const childProcess = spawn('afinfo', [songPath], {
            stdio: 'pipe'
        })

        let output = '';

        /**
            * chunk is recived as Buffer, which can be converted into string format using toString
        */
        childProcess.stdout.on('data', chunk => {
            output += chunk.toString();
        })

        childProcess.stdout.on('end', () => {
            const match = output.match(/estimated duration:\s+([\d.]+)\s+sec/);

            if(!match) {
                reject({
                    duration: null
                })
                return;
            }

            resolve({
                duration: Number(match[1]).toFixed(2),
            });
        })

        childProcess.stdout.on('error', (err) => {
            reject(err);
        })
    })
}

function seekBar(duration) {

    seekBarInterval = setInterval(() => {
        if(paused) {
            return;
        }
        // convert to seconds
        const timeElapsed = Number(((Date.now() - startTime - totalPausedTime) / 1000).toFixed(0));
        currentTimeElapsed = timeElapsed;
        
        if(timeElapsed >= duration) {
            drawSeekBar(duration, duration);
            clearInterval(seekBarInterval);
        } else {
            drawSeekBar(timeElapsed, duration);
        }
    }, 1000);
}

function drawSeekBar(timeElapsed, duration) {
    const width = 30;
    const fraction = timeElapsed / duration;

    const fill = Math.floor(fraction * width);
    const empty = width - fill;

    const seekBarRow = allSongs.length + 2;
    const bar = `${'█'.repeat(fill)}${'░'.repeat(empty)}`
    process.stdout.write(`\x1B[${seekBarRow};1H\x1B[2K[${bar}] ${timeElapsed}/${duration}`)
}

process.stdin.on('data', chunk => {
    
    if(chunk[0] === 3 || chunk[0] === 81 || chunk[0] === 113) {
        process.kill(process.pid, 'SIGINT'); 
        return;
    }

    /**
        arrow key detection, since arrow keys arrives in 3 Bytes, length of chunk = 3
     */

    /**
        gets the escape character
     */
    if(chunk[0] === 27) {
        if(chunk.length === 1) {
            // standalone Esc key — exit player
            process.kill(process.pid, 'SIGINT');
            return;
        }
        if(chunk[1] === 91) {
            if(chunk[2] === 65) {
                currentSongIndex = (currentSongIndex === 0 ? allSongs.length - 1 : currentSongIndex - 1) % allSongs.length;
                buildMenu()
            } else if(chunk[2] === 66) {
                currentSongIndex = (currentSongIndex + 1) % allSongs.length;
                buildMenu();
            } else if(chunk[2] === 67) {
                // right arrow key — seek forward 10 seconds
                if(player && currentDuration > 0) {
                    const newPos = Math.min(currentTimeElapsed + 10, currentDuration);
                    player.stdin.write(`seek ${newPos}\n`);
                    startTime -= 10 * 1000; // adjust so seekbar stays in sync
                    currentTimeElapsed = newPos;
                    drawSeekBar(newPos, currentDuration);
                }
            } else if(chunk[2] === 68) {
                // left arrow key — seek backward 10 seconds
                if(player && currentDuration > 0) {
                    const newPos = Math.max(currentTimeElapsed - 10, 0);
                    player.stdin.write(`seek ${newPos}\n`);
                    startTime += 10 * 1000; // adjust so seekbar stays in sync
                    currentTimeElapsed = newPos;
                    drawSeekBar(newPos, currentDuration);
                }
            }
        }
        return
    }

    /**
        enter key represent carriage return
        ascii code is 13
     */
    if(chunk[0] === 13) {
        if(player && currentSongIndex === playingSongIndex) {
            // Same song selected — toggle pause/resume
            player.stdin.write(`pause\n`);

            if(paused) {
                totalPausedTime += Date.now() - pausedAt;
            } else {
                pausedAt = Date.now();
            }

            paused = !paused;
        } else {
            // Different song selected or no song playing — play selected song
            playSong();
        }
        return;
    }

    /**
        pause, resume
     */

    if(chunk[0] === 80 || chunk[0] === 112) {
        if(!player) return;
        player.stdin.write(`pause\n`);

        if(paused) {
            totalPausedTime += Date.now() - pausedAt;
        } else {
            // pause music
            pausedAt = Date.now()
        }

        paused = !paused;
        return
    }

    /**
        next (n), previous (b)
     */

    if(chunk[0] === 78 || chunk[0] === 110) {
        // next
        currentSongIndex = (currentSongIndex + 1) % allSongs.length;
        buildMenu();
        playSong();
        return
    }

    if(chunk[0] === 66 || chunk[0] === 98) {
        // b previous
        currentSongIndex = (currentSongIndex === 0 ? allSongs.length - 1 : currentSongIndex - 1) % allSongs.length;
        buildMenu();
        playSong();
        return
    }
    
})

process.on('SIGINT', signal => {
    if(player) {
        player.kill();
        player = null;
    }
    clearInterval(seekBarInterval);
    process.stdout.write('\x1B[?25h');   // show cursor
    process.stdout.write('\x1B[?1049l'); // restore main screen buffer
    console.log(`Closing player with recieved signal as: ${signal}`);
    console.log('Bye Bye');
    process.exit();
})

buildMenu();