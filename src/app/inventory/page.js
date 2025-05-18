
import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const InventoryManagement = ({ initialIngredients = [] }) => {
  const { socket, isConnected } = useSocket();
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    stockLevel: 0,
    minimumThreshold: 0,
    isActive: true,
  });
  const [stockUpdate, setStockUpdate] = useState({ id: '', quantity: 0, operation: 'add' });
  const [error, setError] = useState(null);
  const sessionId = 'user-session-id'; // Replace with actual session ID from auth context

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Fetch ingredients if not provided via SSR
    if (!initialIngredients.length) {
      socket.emit('ingredient:getAll', {}, (response) => {
        if (response.success) {
          setIngredients(response.ingredients);
        } else {
          setError(response.message);
        }
      });
    }

    // Real-time updates
    socket.on('ingredient:created', (ingredient) => {
      setIngredients((prev) => [...prev, ingredient]);
    });

    socket.on('ingredient:updated', (ingredient) => {
      setIngredients((prev) =>
        prev.map((item) => (item._id === ingredient._id ? ingredient : item))
      );
    });

    socket.on('ingredient:deleted', ({ id }) => {
      setIngredients((prev) => prev.filter((item) => item._id !== id));
    });

    socket.on('ingredient:lowStock', ({ id, name, stockLevel }) => {
      alert(`Low stock alert: ${name} has ${stockLevel} units remaining`);
    });

    return () => {
      socket.off('ingredient:created');
      socket.off('ingredient:updated');
      socket.off('ingredient:deleted');
      socket.off('ingredient:lowStock');
    };
  }, [socket, isConnected, initialIngredients]);

  const handleCreate = () => {
    if (!socket) return;
    socket.emit('ingredient:create', { ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      } else {
        setFormData({
          name: '',
          unit: '',
          stockLevel: 0,
          minimumThreshold: 0,
          isActive: true,
        });
      }
    });
  };

  const handleUpdate = (id) => {
    if (!socket) return;
    socket.emit('ingredient:update', { id, ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const handleDelete = (id) => {
    if (!socket) return;
    socket.emit('ingredient:delete', { id, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const handleStockUpdate = () => {
    if (!socket) return;
    socket.emit('ingredient:updateStock', { ...stockUpdate, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      } else {
        setStockUpdate({ id: '', quantity: 0, operation: 'add' });
      }
    });
  };

  const generateReport = () => {
    if (!socket) return;
    socket.emit('ingredient:generateReport', {}, (response) => {
      if (response.success) {
        alert(`Inventory Report: ${JSON.stringify(response.report, null, 2)}`);
      } else {
        setError(response.message);
      }
    });
  };

  return (
    <div>
      <h2>Inventory Management</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!isConnected && <p>Connecting to server...</p>}
      <div>
        <h3>Create/Update Ingredient</h3>
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Unit"
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
        />
        <input
          type="number"
          placeholder="Stock Level"
          value={formData.stockLevel}
          onChange={(e) =>
            setFormData({ ...formData, stockLevel: Number(e.target.value) })
          }
        />
        <input
          type="number"
          placeholder="Minimum Threshold"
          value={formData.minimumThreshold}
          onChange={(e) =>
            setFormData({ ...formData, minimumThreshold: Number(e.target.value) })
          }
        />
        <button onClick={handleCreate} disabled={!isConnected}>
          Create Ingredient
        </button>
      </div>
      <div>
        <h3>Update Stock</h3>
        <input
          type="text"
          placeholder="Ingredient ID"
          value={stockUpdate.id}
          onChange={(e) => setStockUpdate({ ...stockUpdate, id: e.target.value })}
        />
        <input
          type="number"
          placeholder="Quantity"
          value={stockUpdate.quantity}
          onChange={(e) =>
            setStockUpdate({ ...stockUpdate, quantity: Number(e.target.value) })
          }
        />
        <select
          value={stockUpdate.operation}
          onChange={(e) =>
            setStockUpdate({ ...stockUpdate, operation: e.target.value })
          }
        >
          <option value="add">Add</option>
          <option value="subtract">Subtract</option>
        </select>
        <button onClick={handleStockUpdate} disabled={!isConnected}>
          Update Stock
        </button>
      </div>
      <div>
        <h3>Ingredients</h3>
        <button onClick={generateReport} disabled={!isConnected}>
          Generate Inventory Report
        </button>
        <ul>
          {ingredients.map((item) => (
            <li key={item._id}>
              {item.name} - {item.stockLevel} {item.unit} (
              {item.isActive ? 'Active' : 'Inactive'})
              <button onClick={() => handleUpdate(item._id)} disabled={!isConnected}>
                Update
              </button>
              <button onClick={() => handleDelete(item._id)} disabled={!isConnected}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default InventoryManagement;