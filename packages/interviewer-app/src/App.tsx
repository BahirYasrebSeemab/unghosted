import type { Room } from "@unghosted/shared"

// Placeholder shell for the interviewer app. This is intentionally minimal —
// the real dashboard (risk score, monitor cards, event log) currently lives
// in packages/candidate-app/src/App.tsx and still needs to be split out:
// the parts that watch *remote* room state belong here, the parts that
// *produce* signals stay in the candidate app. See ROADMAP.md for sequencing
// (auth UI, then the dashboard rebuild, then UI redesign pass).

const placeholderRoom: Pick<Room, "candidateName" | "role" | "status"> = {
  candidateName: "—",
  role: "—",
  status: "scheduled",
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-sans flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-lg font-semibold text-slate-100">UnGhosted Interviewer</h1>
        <p className="text-sm text-slate-500">
          Dashboard shell — login, room list, and the live monitoring view are not built yet.
          See <code className="text-amber-500">ROADMAP.md</code> for what's next.
        </p>
        <p className="text-xs font-mono text-slate-700">room status placeholder: {placeholderRoom.status}</p>
      </div>
    </div>
  )
}
