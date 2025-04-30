import type { FC } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import '../styles/MuteToggle.css';

interface MuteToggleProps {
  isMuted: boolean;
  toggleMute: () => void;
}

const MuteToggle: FC<MuteToggleProps> = ({ isMuted, toggleMute }) => {
  return (
    <button 
      type="button" 
      onClick={toggleMute} 
      className="mute-toggle-button" 
      aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
    >
      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
};

export default MuteToggle; 