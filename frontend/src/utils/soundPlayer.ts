import * as Tone from 'tone';

// Create synths for different sounds
const synth = new Tone.Synth({
    oscillator: {
        type: 'triangle'
    },
    envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.1,
        release: 0.3
    }
}).toDestination();

const errorSynth = new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 10,
    detune: 0,
    oscillator: {
        type: 'sine'
    },
    envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.05,
        release: 0.2
    },
    modulation: {
        type: 'square'
    },
    modulationEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.1,
        release: 0.2
    }
}).toDestination();

const winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
        type: 'sine'
    },
    envelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.3,
        release: 0.5
    }
}).toDestination();

// Function to play sounds
export const playSound = async (type: 'correct' | 'incorrect' | 'win' | 'lose') => {
    // Ensure Tone.js context is started (required by browsers)
    await Tone.start();

    const now = Tone.now();

    switch (type) {
        case 'correct':
            synth.triggerAttackRelease('C5', '8n', now);
            break;
        case 'incorrect':
            errorSynth.triggerAttackRelease('F#3', '8n', now);
            break;
        case 'win':
            // Play a simple chord or arpeggio
            winSynth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n', now);
            break;
        case 'lose':
            // Play a descending sound
            errorSynth.triggerAttackRelease('C4', '4n', now);
            errorSynth.triggerAttackRelease('A3', '4n', now + 0.2);
            errorSynth.triggerAttackRelease('F3', '4n', now + 0.4);
            break;
        default:
            break;
    }
}; 