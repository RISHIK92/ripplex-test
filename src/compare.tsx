import { useRipple } from "ripplex-core";
import { appStore } from "./ripples/rippleStore";
import { useZustandStore } from "./ripples/zustandStore";

function generateProjects(count = 3000) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Project ${i + 1}`,
    tasks: [],
  }));
}

export default function Compare() {
  // Ripplex
  const ripplexProjects = useRipple(appStore.projects);

  const handleRipplexLoad = () => {
    appStore.projects.value = generateProjects();
  };

  const setZustandProjects = useZustandStore((s: any) => s.loadAll);
  const zustandProjects = useZustandStore((s: any) => s.projects);
  const handleZustandLoad = () => {
    setZustandProjects(generateProjects());
  };

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1, borderRight: "2px solid #eee", paddingRight: 16 }}>
        <h2>Ripplex Projects (3000)</h2>
        <button onClick={handleRipplexLoad}>Load Projects</button>
        {
          <>
            <ul>
              {ripplexProjects?.map((p: any) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </>
        }
      </div>
      <div style={{ flex: 1, paddingLeft: 16 }}>
        <h2>Zustand Projects (3000)</h2>
        <button onClick={handleZustandLoad}>Load Projects</button>
        {
          <>
            <ul>
              {zustandProjects.map((p: any) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </>
        }
      </div>
    </div>
  );
}
