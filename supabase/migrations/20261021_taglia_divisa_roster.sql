-- Taglia provata dal ragazzo, per assegnargli la divisa giusta. Le divise della società vanno dalla S alla XL.
-- Visibile come il resto della rosa (admin e allenatori), mai nelle viste pubbliche.
alter table roster add column if not exists taglia_divisa text check (taglia_divisa in ('S', 'M', 'L', 'XL'));
