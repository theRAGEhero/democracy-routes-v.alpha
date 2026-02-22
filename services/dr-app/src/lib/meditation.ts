export const MEDITATION_ANIMATIONS = [
  { id: "relax-01-aurora", label: "Aurora", file: "/meditation/relax-01-aurora.html" },
  { id: "relax-02-nebula", label: "Nebula", file: "/meditation/relax-02-nebula.html" },
  { id: "relax-03-tide", label: "Tide", file: "/meditation/relax-03-tide.html" },
  { id: "relax-04-dunes", label: "Dunes", file: "/meditation/relax-04-dunes.html" },
  { id: "relax-05-forest", label: "Forest", file: "/meditation/relax-05-forest.html" },
  { id: "relax-06-lanterns", label: "Lanterns", file: "/meditation/relax-06-lanterns.html" },
  { id: "relax-07-ice", label: "Ice", file: "/meditation/relax-07-ice.html" },
  { id: "relax-08-orbit", label: "Orbit", file: "/meditation/relax-08-orbit.html" },
  { id: "relax-09-ink", label: "Ink", file: "/meditation/relax-09-ink.html" },
  { id: "relax-10-prism", label: "Prism", file: "/meditation/relax-10-prism.html" },
  { id: "relax-11-rain", label: "Rain", file: "/meditation/relax-11-rain.html" },
  { id: "relax-12-fog", label: "Fog", file: "/meditation/relax-12-fog.html" },
  { id: "relax-13-wilt", label: "Wilt", file: "/meditation/relax-13-wilt.html" },
  { id: "relax-14-embers", label: "Embers", file: "/meditation/relax-14-embers.html" },
  { id: "relax-15-ruins", label: "Ruins", file: "/meditation/relax-15-ruins.html" },
  { id: "relax-16-station", label: "Station", file: "/meditation/relax-16-station.html" },
  { id: "relax-17-ashes", label: "Ashes", file: "/meditation/relax-17-ashes.html" },
  { id: "relax-18-hollow", label: "Hollow", file: "/meditation/relax-18-hollow.html" },
  { id: "relax-19-snow", label: "Snow", file: "/meditation/relax-19-snow.html" },
  { id: "relax-20-mourn", label: "Mourn", file: "/meditation/relax-20-mourn.html" },
  { id: "relax-21-sunrise", label: "Sunrise", file: "/meditation/relax-21-sunrise.html" },
  { id: "relax-22-confetti", label: "Confetti", file: "/meditation/relax-22-confetti.html" },
  { id: "relax-23-balloons", label: "Balloons", file: "/meditation/relax-23-balloons.html" },
  { id: "relax-24-garden", label: "Garden", file: "/meditation/relax-24-garden.html" },
  { id: "relax-25-breeze", label: "Breeze", file: "/meditation/relax-25-breeze.html" },
  { id: "relax-26-fireflies", label: "Fireflies", file: "/meditation/relax-26-fireflies.html" },
  { id: "relax-27-ribbon", label: "Ribbon", file: "/meditation/relax-27-ribbon.html" },
  { id: "relax-28-bubblegum", label: "Bubblegum", file: "/meditation/relax-28-bubblegum.html" },
  { id: "relax-29-citrus", label: "Citrus", file: "/meditation/relax-29-citrus.html" },
  { id: "relax-30-carnival", label: "Carnival", file: "/meditation/relax-30-carnival.html" }
];

export function getMeditationAnimationFile(id?: string | null) {
  if (!id) return MEDITATION_ANIMATIONS[0]?.file ?? "";
  return MEDITATION_ANIMATIONS.find((item) => item.id === id)?.file ?? "";
}
