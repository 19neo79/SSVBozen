import { playerCategory } from '../../lib/categoria';

export function CategoriaTag({ dataNascita }: { dataNascita: string | null }) {
  const cat = playerCategory(dataNascita);
  if (!cat) return null;
  return <span className={`tag-categoria ${cat.toLowerCase()}`}>{cat}</span>;
}
