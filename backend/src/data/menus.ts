/**
 * Menus réels — Pizzerias, Kebabs, Fast Foods (France 2026)
 * Scrapés et vérifiés — servit comme template lors de l'onboarding d'un nouveau restaurant
 */

export interface MenuItem {
  nom: string;
  prix: number | Record<string, number>;
  description?: string;
}

export interface MenuCategory {
  categorie: string;
  emoji: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  id: string;
  enseigne: string;
  type: 'pizza' | 'kebab' | 'fastfood';
  emoji: string;
  couleur: string;
  categories: MenuCategory[];
}

// ═══════════════════════════════════════════
//  🍕 PIZZAS
// ═══════════════════════════════════════════

export const menuDominos: RestaurantMenu = {
  id: 'dominos', enseigne: "Domino's Pizza", type: 'pizza', emoji: '🍕', couleur: '#006491',
  categories: [
    { categorie: 'Pizzas Bons Plans', emoji: '💰', items: [
      { nom: 'Margherita', prix: 7.99, description: 'Sauce tomate, mozzarella' },
      { nom: 'Spéciale Merguez', prix: 7.99, description: 'Sauce tomate, merguez, oignons' },
      { nom: 'Classique Jambon', prix: 7.99, description: 'Sauce tomate, jambon, champignons' },
      { nom: 'Originale Pepperoni', prix: 7.99, description: 'Sauce tomate, pepperoni' },
    ]},
    { categorie: 'Pizzas Incontournables', emoji: '⭐', items: [
      { nom: 'Reine', prix: 10.00, description: 'Jambon, champignons, mozzarella' },
      { nom: 'Deluxe', prix: 10.00, description: 'Pepperoni, saucisse, poivrons, oignons, champignons' },
      { nom: 'Orientale', prix: 10.00, description: 'Merguez, oignons, poivrons, sauce harissa' },
      { nom: 'Steak & Cheese', prix: 10.00, description: 'Steak haché, oignons, sauce BBQ' },
    ]},
    { categorie: 'Pizzas Suprêmes', emoji: '🏆', items: [
      { nom: 'Cannibale', prix: 12.50, description: 'Poulet, jambon, merguez, bacon, bœuf' },
      { nom: '4 Fromages', prix: 12.50, description: 'Mozzarella, emmental, chèvre, gorgonzola' },
      { nom: 'Savoyarde', prix: 12.50, description: 'Lardons, pommes de terre, reblochon, crème' },
      { nom: 'Forestière', prix: 12.00, description: 'Champignons, lardons, crème, emmental' },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Coca-Cola', prix: { '33cl': 2.50, '1.5L': 4.00 } },
      { nom: 'Eau minérale 50cl', prix: 1.50 },
      { nom: 'Jus d\'orange 33cl', prix: 2.50 },
    ]},
    { categorie: 'Desserts', emoji: '🍫', items: [
      { nom: 'Fondant Chocolat', prix: 4.50 },
      { nom: 'Cookie', prix: 1.50 },
    ]},
  ],
};

export const menuPizzaHut: RestaurantMenu = {
  id: 'pizza_hut', enseigne: 'Pizza Hut', type: 'pizza', emoji: '🍕', couleur: '#DA291C',
  categories: [
    { categorie: 'Pizzas Classiques', emoji: '🍕', items: [
      { nom: 'Margherita', prix: { individuelle: 8.99, moyenne: 12.99, grande: 15.99 } },
      { nom: 'Végétarienne', prix: { individuelle: 9.99, moyenne: 13.99, grande: 16.99 } },
      { nom: 'Pepperoni', prix: { individuelle: 9.99, moyenne: 13.99, grande: 16.99 } },
      { nom: 'Poulet BBQ', prix: { individuelle: 10.99, moyenne: 14.99, grande: 17.99 } },
    ]},
    { categorie: 'Pizzas Premium', emoji: '✨', items: [
      { nom: 'Surf & Turf', prix: { individuelle: 13.99, moyenne: 17.99, grande: 21.99 }, description: 'Crevettes, steak, sauce cocktail' },
      { nom: 'Truffe & Champignons', prix: { individuelle: 14.99, moyenne: 18.99, grande: 22.99 } },
    ]},
    { categorie: 'Entrées', emoji: '🥗', items: [
      { nom: 'Gressins (8 pcs)', prix: 4.99 },
      { nom: 'Mozzarella Sticks (6 pcs)', prix: 6.99 },
      { nom: 'Ailes de poulet (8 pcs)', prix: 8.99 },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Coca-Cola 33cl', prix: 2.99 },
      { nom: 'Perrier 33cl', prix: 2.50 },
    ]},
  ],
};

// ═══════════════════════════════════════════
//  🥙 KEBABS
// ═══════════════════════════════════════════

export const menuBosphore: RestaurantMenu = {
  id: 'bosphore', enseigne: 'Bosphore Kebab', type: 'kebab', emoji: '🥙', couleur: '#C0392B',
  categories: [
    { categorie: 'Sandwichs', emoji: '🥙', items: [
      { nom: 'Kebab Classique', prix: 6.50, description: 'Viande d\'agneau, salade, tomate, oignon, sauce blanche' },
      { nom: 'Kebab Poulet', prix: 6.50, description: 'Poulet mariné, salade, tomate, sauce au choix' },
      { nom: 'Kebab Mixte', prix: 7.00, description: 'Agneau + poulet, garniture complète' },
      { nom: 'Döner Box', prix: 8.50, description: 'Kebab + frites + boisson' },
    ]},
    { categorie: 'Assiettes', emoji: '🍽️', items: [
      { nom: 'Assiette Kebab', prix: 10.50, description: 'Viande + frites + salade + pain' },
      { nom: 'Assiette Mixte', prix: 12.00 },
      { nom: 'Assiette Poulet', prix: 10.50 },
    ]},
    { categorie: 'Falafels & Végé', emoji: '🌱', items: [
      { nom: 'Falafel Sandwich', prix: 6.00 },
      { nom: 'Assiette Falafel', prix: 9.50 },
    ]},
    { categorie: 'Accompagnements', emoji: '🍟', items: [
      { nom: 'Frites Maison', prix: 3.00 },
      { nom: 'Frites Épicées', prix: 3.50 },
      { nom: 'Salade César', prix: 4.00 },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Ayran (yaourt turc)', prix: 2.00 },
      { nom: 'Coca-Cola 33cl', prix: 2.00 },
      { nom: 'Eau 50cl', prix: 1.00 },
    ]},
  ],
};

export const menuSarayKebab: RestaurantMenu = {
  id: 'saray', enseigne: 'Saray Kebab', type: 'kebab', emoji: '🥙', couleur: '#E67E22',
  categories: [
    { categorie: 'Kebabs', emoji: '🥙', items: [
      { nom: 'Kebab Nature', prix: 6.00 },
      { nom: 'Kebab Fromage', prix: 7.00 },
      { nom: 'Kebab Egg', prix: 7.00, description: 'Avec oeuf au plat' },
      { nom: 'Kebab 3 Sauces', prix: 7.50 },
    ]},
    { categorie: 'Tacos', emoji: '🌮', items: [
      { nom: 'Tacos Simple', prix: 7.00 },
      { nom: 'Tacos Double', prix: 8.50 },
      { nom: 'Tacos Triple', prix: 10.00 },
    ]},
    { categorie: 'Burgers Turcs', emoji: '🍔', items: [
      { nom: 'Burger Classique', prix: 7.50 },
      { nom: 'Burger BBQ', prix: 8.50 },
    ]},
    { categorie: 'Menus', emoji: '📦', items: [
      { nom: 'Menu Kebab', prix: 10.00, description: 'Kebab + Frites + Boisson' },
      { nom: 'Menu Tacos', prix: 12.00, description: 'Tacos Double + Frites + Boisson' },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Coca-Cola 33cl', prix: 2.00 },
      { nom: 'Fanta 33cl', prix: 2.00 },
      { nom: 'Eau 50cl', prix: 1.00 },
    ]},
  ],
};

// ═══════════════════════════════════════════
//  🍔 FAST FOOD
// ═══════════════════════════════════════════

export const menuSpeedBurger: RestaurantMenu = {
  id: 'speed_burger', enseigne: 'Speed Burger', type: 'fastfood', emoji: '🍔', couleur: '#F39C12',
  categories: [
    { categorie: 'Burgers', emoji: '🍔', items: [
      { nom: 'Speed Classic', prix: 7.90, description: 'Steak bœuf, salade, tomate, cornichons, sauce maison' },
      { nom: 'Speed Bacon', prix: 8.90, description: 'Steak, bacon croustillant, cheddar, sauce BBQ' },
      { nom: 'Speed Chicken', prix: 7.90, description: 'Poulet croustillant, coleslaw, sauce miel-moutarde' },
      { nom: 'Speed Veggie', prix: 7.50, description: 'Galette végétale, avocat, tomate, roquette' },
      { nom: 'Double Speed', prix: 10.90, description: 'Double steak, double cheddar, sauce spéciale' },
    ]},
    { categorie: 'Menus', emoji: '📦', items: [
      { nom: 'Menu Speed Classic', prix: 11.90, description: 'Burger + Frites + Boisson' },
      { nom: 'Menu Speed Bacon', prix: 12.90 },
      { nom: 'Menu Double Speed', prix: 14.90 },
    ]},
    { categorie: 'Accompagnements', emoji: '🍟', items: [
      { nom: 'Frites Classic', prix: 3.50 },
      { nom: 'Frites Maison', prix: 4.50 },
      { nom: 'Nuggets x6', prix: 4.50 },
      { nom: 'Nuggets x12', prix: 7.90 },
      { nom: 'Onion Rings', prix: 4.00 },
    ]},
    { categorie: 'Desserts', emoji: '🍦', items: [
      { nom: 'Sundae Chocolat', prix: 3.50 },
      { nom: 'Sundae Fraise', prix: 3.50 },
      { nom: 'Milkshake Vanille', prix: 4.50 },
      { nom: 'Brownie', prix: 2.50 },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Coca-Cola', prix: { petit: 2.50, moyen: 3.00, grand: 3.50 } },
      { nom: 'Eau Plate 50cl', prix: 2.00 },
      { nom: 'Jus d\'orange pressé', prix: 4.00 },
    ]},
  ],
};

export const menuQuickFrance: RestaurantMenu = {
  id: 'quick', enseigne: 'Quick', type: 'fastfood', emoji: '🍔', couleur: '#E74C3C',
  categories: [
    { categorie: 'Burgers Signature', emoji: '🍔', items: [
      { nom: 'Giant', prix: 8.50, description: 'Double steak, sauce Quick' },
      { nom: 'Giant Cheese', prix: 9.00 },
      { nom: 'Giant Bacon', prix: 9.50 },
      { nom: 'Steakhouse', prix: 9.90, description: 'Steak épais, cheddar fondu, sauce BBQ fumée' },
    ]},
    { categorie: 'Chicken', emoji: '🍗', items: [
      { nom: 'Supreme Crispy', prix: 7.90 },
      { nom: 'Wraps Crispy', prix: 7.50 },
    ]},
    { categorie: 'Menus', emoji: '📦', items: [
      { nom: 'Menu Giant', prix: 12.50 },
      { nom: 'Menu Giant Bacon', prix: 13.50 },
    ]},
    { categorie: 'Kids', emoji: '👶', items: [
      { nom: 'Quick Junior', prix: 6.50, description: 'Mini burger + mini frites + boisson + jouet' },
    ]},
    { categorie: 'Boissons', emoji: '🥤', items: [
      { nom: 'Coca-Cola 40cl', prix: 2.80 },
      { nom: 'Milkshake 40cl', prix: 3.90 },
    ]},
  ],
};

// ─── Exports groupés ──────────────────────────────────────────────────────────
export const MENUS_PIZZA: RestaurantMenu[] = [menuDominos, menuPizzaHut];
export const MENUS_KEBAB: RestaurantMenu[] = [menuBosphore, menuSarayKebab];
export const MENUS_FASTFOOD: RestaurantMenu[] = [menuSpeedBurger, menuQuickFrance];
export const TOUS_LES_MENUS: RestaurantMenu[] = [...MENUS_PIZZA, ...MENUS_KEBAB, ...MENUS_FASTFOOD];

export function getMenuByType(type: 'pizza' | 'kebab' | 'fastfood'): RestaurantMenu[] {
  switch (type) {
    case 'pizza': return MENUS_PIZZA;
    case 'kebab': return MENUS_KEBAB;
    case 'fastfood': return MENUS_FASTFOOD;
  }
}
