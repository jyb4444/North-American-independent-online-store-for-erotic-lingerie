const sizes = [
  { size: 'XS', us: '0–2', bust_in: '31–32', waist_in: '23–24', hip_in: '33–34', bust_cm: '79–81', waist_cm: '58–61', hip_cm: '84–86' },
  { size: 'S', us: '4–6', bust_in: '33–34', waist_in: '25–26', hip_in: '35–36', bust_cm: '84–86', waist_cm: '63–66', hip_cm: '89–91' },
  { size: 'M', us: '8–10', bust_in: '35–36', waist_in: '27–28', hip_in: '37–38', bust_cm: '89–91', waist_cm: '68–71', hip_cm: '94–97' },
  { size: 'L', us: '12–14', bust_in: '37–39', waist_in: '29–31', hip_in: '39–41', bust_cm: '94–99', waist_cm: '74–79', hip_cm: '99–104' },
  { size: 'XL', us: '16–18', bust_in: '40–42', waist_in: '32–34', hip_in: '42–44', bust_cm: '102–107', waist_cm: '81–86', hip_cm: '107–112' },
  { size: 'XXL', us: '20–22', bust_in: '43–45', waist_in: '35–37', hip_in: '45–47', bust_cm: '109–114', waist_cm: '89–94', hip_cm: '114–119' },
];

export default function SizeGuideContent() {
  return (
    <div className="space-y-6 text-sm text-ivory-muted">
      <div className="grid grid-cols-3 gap-4 text-xs">
        {[
          { label: 'Bust', desc: 'Measure around the fullest part of your chest, keeping the tape horizontal.' },
          { label: 'Waist', desc: 'Measure around the narrowest part of your natural waist.' },
          { label: 'Hip', desc: 'Measure around the fullest part of your hips and buttocks.' },
        ].map(({ label, desc }) => (
          <div key={label}>
            <p className="mb-1 font-medium uppercase tracking-widest text-ivory">{label}</p>
            <p>{desc}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold-600/20">
              <th className="pb-2 pr-4 text-left font-medium uppercase tracking-widest text-gold-400">Size</th>
              <th className="pb-2 pr-4 text-left font-medium uppercase tracking-widest text-ivory-muted">US</th>
              <th className="pb-2 pr-4 text-center font-medium uppercase tracking-widest text-ivory-muted" colSpan={2}>Bust</th>
              <th className="pb-2 pr-4 text-center font-medium uppercase tracking-widest text-ivory-muted" colSpan={2}>Waist</th>
              <th className="pb-2 text-center font-medium uppercase tracking-widest text-ivory-muted" colSpan={2}>Hip</th>
            </tr>
            <tr className="border-b border-gold-600/10 text-ivory-dim">
              <th /><th />
              <th className="pb-1 text-center">in</th><th className="pb-1 text-center">cm</th>
              <th className="pb-1 text-center">in</th><th className="pb-1 text-center">cm</th>
              <th className="pb-1 text-center">in</th><th className="pb-1 text-center">cm</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((row) => (
              <tr key={row.size} className="border-b border-gold-600/10 hover:bg-wine-800 transition">
                <td className="py-2.5 pr-4 font-medium text-gold-400">{row.size}</td>
                <td className="py-2.5 pr-4 text-ivory-muted">{row.us}</td>
                <td className="py-2.5 pr-4 text-center text-ivory-muted">{row.bust_in}</td>
                <td className="py-2.5 pr-4 text-center text-ivory-muted">{row.bust_cm}</td>
                <td className="py-2.5 pr-4 text-center text-ivory-muted">{row.waist_in}</td>
                <td className="py-2.5 pr-4 text-center text-ivory-muted">{row.waist_cm}</td>
                <td className="py-2.5 pr-4 text-center text-ivory-muted">{row.hip_in}</td>
                <td className="py-2.5 text-center text-ivory-muted">{row.hip_cm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ivory-dim">
        ✦ Between sizes? Size up for comfort. &nbsp; ✦ Free Size fits approximately XS–M.
      </p>
    </div>
  );
}
