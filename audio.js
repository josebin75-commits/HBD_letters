// Web Audio API 기반 감성 오르골 생일 축하 노래 플레이어
class MusicBoxPlayer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.loopTimeout = null;
    this.bpm = 85;
    this.noteDur = 60 / this.bpm; // 1박자의 초 단위 시간
    this.totalBeats = 27; // 전체 멜로디의 총 박자 수 (여운 포함)
    
    // 음계별 주파수 정의
    this.frequencies = {
      'A#2': 116.54,
      'C3': 130.81, 'G3': 196.00, 'F3': 174.61,
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'A#4': 233.08, 'Bb4': 466.16,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46,
    };

    // 멜로디 정의 (음표, 시작 박자, 지속 박자)
    this.melody = [
      // 마디 1
      { note: 'C4', beat: 0, dur: 0.75 }, { note: 'C4', beat: 0.75, dur: 0.25 },
      { note: 'D4', beat: 1.0, dur: 1.0 },
      { note: 'C4', beat: 2.0, dur: 1.0 },
      // 마디 2
      { note: 'F4', beat: 3.0, dur: 1.0 },
      { note: 'E4', beat: 4.0, dur: 2.0 },
      // 마디 3
      { note: 'C4', beat: 6.0, dur: 0.75 }, { note: 'C4', beat: 6.75, dur: 0.25 },
      { note: 'D4', beat: 7.0, dur: 1.0 },
      { note: 'C4', beat: 8.0, dur: 1.0 },
      // 마디 4
      { note: 'G4', beat: 9.0, dur: 1.0 },
      { note: 'F4', beat: 10.0, dur: 2.0 },
      // 마디 5
      { note: 'C4', beat: 12.0, dur: 0.75 }, { note: 'C4', beat: 12.75, dur: 0.25 },
      { note: 'C5', beat: 13.0, dur: 1.0 },
      { note: 'A4', beat: 14.0, dur: 1.0 },
      // 마디 6
      { note: 'F4', beat: 15.0, dur: 1.0 },
      { note: 'E4', beat: 16.0, dur: 1.0 },
      { note: 'D4', beat: 17.0, dur: 1.0 },
      // 마디 7
      { note: 'Bb4', beat: 18.0, dur: 0.75 }, { note: 'Bb4', beat: 18.75, dur: 0.25 },
      { note: 'A4', beat: 19.0, dur: 1.0 },
      { note: 'F4', beat: 20.0, dur: 1.0 },
      // 마디 8
      { note: 'G4', beat: 21.0, dur: 1.0 },
      { note: 'F4', beat: 22.0, dur: 2.0 },
    ];

    // 반주 아르페지오 정의 (음표, 시작 박자, 지속 박자)
    this.accompaniment = [
      // 마디 1 (F)
      { note: 'F3', beat: 0, dur: 1.0 }, { note: 'C4', beat: 1, dur: 1.0 }, { note: 'F4', beat: 2, dur: 1.0 },
      // 마디 2 (F)
      { note: 'F3', beat: 3, dur: 1.0 }, { note: 'C4', beat: 4, dur: 1.0 }, { note: 'F4', beat: 5, dur: 1.0 },
      // 마디 3 (C)
      { note: 'C3', beat: 6, dur: 1.0 }, { note: 'G3', beat: 7, dur: 1.0 }, { note: 'E4', beat: 8, dur: 1.0 },
      // 마디 4 (C)
      { note: 'C3', beat: 9, dur: 1.0 }, { note: 'G3', beat: 10, dur: 1.0 }, { note: 'E4', beat: 11, dur: 1.0 },
      // 마디 5 (F)
      { note: 'F3', beat: 12, dur: 1.0 }, { note: 'C4', beat: 13, dur: 1.0 }, { note: 'F4', beat: 14, dur: 1.0 },
      // 마디 6 (Bb)
      { note: 'A#2', beat: 15, dur: 1.0 }, { note: 'F3', beat: 16, dur: 1.0 }, { note: 'D4', beat: 17, dur: 1.0 },
      // 마디 7 (F)
      { note: 'F3', beat: 18, dur: 1.0 }, { note: 'C4', beat: 19, dur: 1.0 }, { note: 'A4', beat: 20, dur: 1.0 },
      // 마디 8 (C -> F)
      { note: 'C3', beat: 21, dur: 1.0 }, { note: 'G3', beat: 22, dur: 1.0 }, { note: 'Bb4', beat: 23, dur: 1.0 },
      // 마디 9 (F 으뜸음 여운)
      { note: 'F3', beat: 24, dur: 3.0 }
    ];
  }

  // Audio Context 초기화
  initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.setVolume(CONFIG.bgmVolume || 0.4);
    }
  }

  // 볼륨 설정 (0.0 ~ 1.0)
  setVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(value, this.ctx.currentTime);
    }
  }

  // 맑은 오르골/금속 종 소리 합성
  playNote(frequency, startTime, duration, isMelody = true) {
    if (!this.ctx) return;

    // 1. 기본 삼각파 (부드럽고 둥근 피아노 느낌)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, startTime);

    // 2. 1옥타브 높은 배음 추가 (오르골의 날카롭고 맑은 금속성 느낌)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, startTime);

    // 연결
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    // 팅 하는 어택과 아늑한 잔향을 위한 볼륨 포인터 설정
    const volumeMultiplier = isMelody ? 0.35 : 0.22; // 반주는 멜로디보다 부드럽게
    
    // 기본파 엔벨로프
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(volumeMultiplier, startTime + 0.015); // 매우 빠른 어택
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration - 0.02); // 아늑한 감쇠

    // 배음파 엔벨로프 (금속 부딪히는 맑은 톤을 위해 감쇠를 더 빠르게)
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(volumeMultiplier * 0.4, startTime + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.45));

    // 재생 및 정지 예약
    osc1.start(startTime);
    osc1.stop(startTime + duration);
    osc2.start(startTime);
    osc2.stop(startTime + duration);
  }

  // 한 사이클 루프 연주
  playLoop() {
    if (!this.isPlaying) return;
    
    this.initContext();
    const now = this.ctx.currentTime;
    
    // 멜로디 연주 스케줄링
    this.melody.forEach(noteObj => {
      const freq = this.frequencies[noteObj.note];
      if (freq) {
        const start = now + noteObj.beat * this.noteDur;
        const dur = noteObj.dur * this.noteDur;
        this.playNote(freq, start, dur, true);
      }
    });

    // 반주 연주 스케줄링
    this.accompaniment.forEach(noteObj => {
      const freq = this.frequencies[noteObj.note];
      if (freq) {
        const start = now + noteObj.beat * this.noteDur;
        const dur = noteObj.dur * this.noteDur;
        this.playNote(freq, start, dur, false);
      }
    });

    // 루프 시간만큼 지난 후 다음 루프 예약
    const loopDurationMs = this.totalBeats * this.noteDur * 1000;
    this.loopTimeout = setTimeout(() => {
      this.playLoop();
    }, loopDurationMs);
  }

  // 시작
  start() {
    this.initContext();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.playLoop();
    }
  }

  // 중지
  stop() {
    this.isPlaying = false;
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
  }
}

// 싱글톤 인스턴스 전역 등록
const musicBox = new MusicBoxPlayer();
