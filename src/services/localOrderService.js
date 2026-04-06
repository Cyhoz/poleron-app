import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDERS_KEY = '@poleron_orders';

export const saveOrder = async (orderData) => {
  try {
    const stored = await AsyncStorage.getItem(ORDERS_KEY);
    const orders = stored ? JSON.parse(stored) : [];
    
    const newOrder = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...orderData
    };
    
    orders.push(newOrder);
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  } catch (error) {
    console.error('Error saving order locally:', error);
    return false;
  }
};

export const getOrders = async () => {
  try {
    const stored = await AsyncStorage.getItem(ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
};

export const deleteOrder = async (orderId) => {
  try {
    const stored = await AsyncStorage.getItem(ORDERS_KEY);
    if (!stored) return false;
    
    const orders = JSON.parse(stored);
    const filtered = orders.filter(o => o.id !== orderId);
    
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
};
