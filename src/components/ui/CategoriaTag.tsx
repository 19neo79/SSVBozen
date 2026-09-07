import { playerCategory } from '../../lib/categoria';

export function CategoriaTag({ dataNascita, soloU15 }: { dataNascita: string | null; soloU15?: boolean }) {
  const cat = playerCategory(dataNascita);
  if (!cat) return null;
  if (soloU15 && cat === 'U14') {
    return <span className="tag-categoria u14 solo-u15" title="Anagraficamente U14, ma convocabile solo in U15">U14 · solo U15</span>;
  }
  return <span className={`tag-categoria ${cat.toLowerCase()}`}>{cat}</span>;
}
