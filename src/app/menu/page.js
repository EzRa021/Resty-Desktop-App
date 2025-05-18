
import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const MenuManagement = ({ initialMenuItems = [], restaurantId, branchId }) => {
  const { socket, isConnected } = useSocket();
  const [menuItems, setMenuItems] = useState(initialMenuItems);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: { regular: 0 },
    category: '',
    subcategory: '',
    restaurantId,
    branchId,
    ingredients: [],
    isActive: true,
  });
  const [error, setError] = useState(null);
  const sessionId = 'user-session-id'; // Replace with actual session ID from auth context

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Fetch menu items if not provided via SSR
    if (!initialMenuItems.length) {
      socket.emit(
        'menuItem:getAll',
        { restaurantId, branchId },
        (response) => {
          if (response.success) {
            setMenuItems(response.menuItems);
          } else {
            setError(response.message);
          }
        }
      );
    }

    // Real-time updates
    socket.on('menuItem:created', (menuItem) => {
      setMenuItems((prev) => [...prev, menuItem]);
    });

    socket.on('menuItem:updated', (menuItem) => {
      setMenuItems((prev) =>
        prev.map((item) => (item._id === menuItem._id ? menuItem : item))
      );
    });

    socket.on('menuItem:deleted', ({ id }) => {
      setMenuItems((prev) => prev.filter((item) => item._id !== id));
    });

    return () => {
      socket.off('menuItem:created');
      socket.off('menuItem:updated');
      socket.off('menuItem:deleted');
    };
  }, [socket, isConnected, restaurantId, branchId, initialMenuItems]);

  const handleCreate = () => {
    if (!socket) return;
    socket.emit('menuItem:create', { ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      } else {
        setFormData({
          name: '',
          description: '',
          price: { regular: 0 },
          category: '',
          subcategory: '',
          restaurantId,
          branchId,
          ingredients: [],
          isActive: true,
        });
      }
    });
  };

  const handleUpdate = (id) => {
    if (!socket) return;
    socket.emit('menuItem:update', { id, ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const handleDelete = (id) => {
    if (!socket) return;
    socket.emit('menuItem:delete', { id, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const checkAvailability = (id) => {
    if (!socket) return;
    socket.emit(
      'menuItem:checkAvailability',
      { id, restaurantId, branchId },
      (response) => {
        if (response.success) {
          alert(`Menu item is ${response.isAvailable ? 'available' : 'unavailable'}`);
        } else {
          setError(response.message);
        }
      }
    );
  };

  return (
    <div>
      <h2>Menu Management</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!isConnected && <p>Connecting to server...</p>}
      <div>
        <h3>Create/Update Menu Item</h3>
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={formData.price.regular}
          onChange={(e) =>
            setFormData({ ...formData, price: { regular: Number(e.target.value) } })
          }
        />
        <input
          type="text"
          placeholder="Category ID"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />
        <input
          type="text"
          placeholder="Subcategory ID"
          value={formData.subcategory}
          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
        />
        <button onClick={handleCreate} disabled={!isConnected}>
          Create Menu Item
        </button>
      </div>
      <div>
        <h3>Menu Items</h3>
        <ul>
          {menuItems.map((item) => (
            <li key={item._id}>
              {item.name} - ${item.price.regular} ({item.isActive ? 'Active' : 'Inactive'})
              <button onClick={() => handleUpdate(item._id)} disabled={!isConnected}>
                Update
              </button>
              <button onClick={() => handleDelete(item._id)} disabled={!isConnected}>
                Delete
              </button>
              <button onClick={() => checkAvailability(item._id)} disabled={!isConnected}>
                Check Availability
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MenuManagement;
