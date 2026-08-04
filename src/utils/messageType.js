// Une commande interne est un message dont la routing key est préfixée "CMD."
// (par opposition à un domain event). La distinction n'existe que par nommage,
// aucun champ dédié n'est exposé par le contrat.
export function isCommande(type) {
  return type?.startsWith('CMD.') ?? false
}
