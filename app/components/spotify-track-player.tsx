"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "../lib/music";

type SpotifyEmbedController = {
  addListener: (event: "ready", listener: () => void) => void;
  destroy: () => void;
  play: () => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    soundPassportSpotifyIframeApi?: SpotifyIframeApi;
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

let spotifyIframeApi: Promise<SpotifyIframeApi> | undefined;

function loadSpotifyIframeApi() {
  if (window.soundPassportSpotifyIframeApi) return Promise.resolve(window.soundPassportSpotifyIframeApi);
  if (spotifyIframeApi) return spotifyIframeApi;
  spotifyIframeApi = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (api) => {
      window.soundPassportSpotifyIframeApi = api;
      resolve(api);
    };
    if (!document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]')) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return spotifyIframeApi;
}

export default function SpotifyTrackPlayer({ track }: { track: Track }) {
  if (track.source === "local" && track.localFile) return <LocalTrackPlayer track={track} />;
  return <SpotifyEmbedPlayer track={track} />;
}

function SpotifyEmbedPlayer({ track }: { track: Track }) {
  const embedTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let controller: SpotifyEmbedController | undefined;

    void loadSpotifyIframeApi().then((api) => {
      if (!active || !embedTarget.current) return;
      api.createController(embedTarget.current, {
        uri: `spotify:track:${track.id}`,
        width: "100%",
        height: 152,
      }, (createdController) => {
        if (!active) {
          createdController.destroy();
          return;
        }
        controller = createdController;
        createdController.addListener("ready", () => {
          if (active) createdController.play();
        });
      });
    });

    return () => {
      active = false;
      controller?.destroy();
    };
  }, [track.id]);

  return (
    <div className="spotify-track-player">
      <div className="spotify-embed-target" ref={embedTarget} aria-label={`${track.title} by ${track.artist}`} />
      {track.source !== "local" && <div className="spotify-player-footer"><a href={track.spotifyUrl} target="_blank" rel="noreferrer">Open full track in Spotify ↗</a></div>}
    </div>
  );
}

function LocalTrackPlayer({ track }: { track: Track }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!track.localFile) return;
    const audio = audioRef.current;
    if (!audio) return;
    const url = URL.createObjectURL(track.localFile);
    audio.src = url;
    audio.autoplay = true;
    const sync = () => {
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setPlaying(!audio.paused);
    };
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    void audio.play().catch(() => setPlaying(false));
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      URL.revokeObjectURL(url);
    };
  }, [track.id, track.localFile]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seek(value: string) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(value);
    setCurrentTime(audio.currentTime);
  }

  return (
    <div className="spotify-track-player local-track-player">
      {/* Music playback does not have a meaningful caption track. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" aria-label={`${track.title} by ${track.artist}`} />
      <div className="local-player-main">
        {track.artwork ? <img src={track.artwork} alt="" /> : <span className="local-player-art">♪</span>}
        <div className="local-player-copy"><strong>{track.title}</strong><span>{track.artist}</span></div>
        <button type="button" className="local-player-button" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}><span className={playing ? "local-pause-icon" : "local-play-icon"} aria-hidden="true" /></button>
      </div>
      <div className="local-player-timeline">
        <span>{formatTime(currentTime)}</span>
        <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} aria-label="Seek through track" disabled={!duration} />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
