const { db } = require('../firebase');

const products = [
  {
    nombre: 'Polerón Generación 2026 - Plan Base',
    descripcion: 'Incluye logo frontal bordado y nombre en espalda. Tela algodón nacional.',
    precioTotal: 35000,
    montoReserva: 10000,
    imagen: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400',
    slug: 'poleron-base'
  },
  {
    nombre: 'Polerón Generación 2026 - Plan Premium',
    descripcion: 'Diseño full sublimado, tela térmica importada, cierres reforzados.',
    precioTotal: 48000,
    montoReserva: 20000,
    imagen: 'https://images.unsplash.com/photo-1574175316155-867f8469d44a?auto=format&fit=crop&q=80&w=400',
    slug: 'poleron-premium'
  }
];

async function initStore() {
    console.log('--- Iniciando Poblamiento de Tienda ---');
    const batch = db.batch();
    
    products.forEach(p => {
        const ref = db.collection('products').doc(p.slug);
        batch.set(ref, p, { merge: true });
    });

    await batch.commit();
    console.log('✅ Tienda inicializada con éxito.');
    process.exit(0);
}

initStore().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
