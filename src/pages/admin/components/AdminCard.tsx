export default function AdminCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-slate-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
