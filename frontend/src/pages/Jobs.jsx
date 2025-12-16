// frontend/src/pages/Jobs.jsx
import JobsList from "./JobsList.jsx";

/**
 * Jobs page wrapper
 * Keeps the route as /dashboard/jobs but delegates UI to JobsList.
 * You can add a header or tabs here later if you want.
 */
export default function Jobs() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Job Portal</h1>
        <p className="text-sm text-gray-600">Discover jobs and internships posted by alumni and companies.</p>
      </header>

      {/* Job listing / create / filters are handled inside JobsList */}
      <JobsList />
    </div>
  );
}
