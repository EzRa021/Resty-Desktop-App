
import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const RecipeManagement = ({ initialRecipes = [], restaurantId, branchId }) => {
  const { socket, isConnected } = useSocket();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [formData, setFormData] = useState({
    name: '',
    restaurantId,
    branchId,
    menuItemId: '',
    ingredients: [],
    preparationInstructions: '',
    isActive: true,
  });
  const [scaleData, setScaleData] = useState({ id: '', scale: 1 });
  const [error, setError] = useState(null);
  const sessionId = 'user-session-id'; // Replace with actual session ID from auth context

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Fetch recipes if not provided via SSR
    if (!initialRecipes.length) {
      socket.emit(
        'recipe:getAll',
        { restaurantId, branchId },
        (response) => {
          if (response.success) {
            setRecipes(response.recipes);
          } else {
            setError(response.message);
          }
        }
      );
    }

    // Real-time updates
    socket.on('recipe:created', (recipe) => {
      setRecipes((prev) => [...prev, recipe]);
    });

    socket.on('recipe:updated', (recipe) => {
      setRecipes((prev) =>
        prev.map((item) => (item._id === recipe._id ? recipe : item))
      );
    });

    socket.on('recipe:deleted', ({ id }) => {
      setRecipes((prev) => prev.filter((item) => item._id !== id));
    });

    return () => {
      socket.off('recipe:created');
      socket.off('recipe:updated');
      socket.off('recipe:deleted');
    };
  }, [socket, isConnected, restaurantId, branchId, initialRecipes]);

  const handleCreate = () => {
    if (!socket) return;
    socket.emit('recipe:create', { ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      } else {
        setFormData({
          name: '',
          restaurantId,
          branchId,
          menuItemId: '',
          ingredients: [],
          preparationInstructions: '',
          isActive: true,
        });
      }
    });
  };

  const handleUpdate = (id) => {
    if (!socket) return;
    socket.emit('recipe:update', { id, ...formData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const handleDelete = (id) => {
    if (!socket) return;
    socket.emit('recipe:delete', { id, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      }
    });
  };

  const checkAvailability = (id) => {
    if (!socket) return;
    socket.emit(
      'recipe:checkAvailability',
      { id, restaurantId, branchId },
      (response) => {
        if (response.success) {
          alert(
            `Recipe is ${
              response.isAvailable ? 'available' : 'unavailable'
            }. Unavailable ingredients: ${JSON.stringify(
              response.unavailableIngredients
            )}`
          );
        } else {
          setError(response.message);
        }
      }
    );
  };

  const handleScale = () => {
    if (!socket) return;
    socket.emit('recipe:scale', { ...scaleData, sessionId }, (response) => {
      if (!response.success) {
        setError(response.message);
      } else {
        setScaleData({ id: '', scale: 1 });
      }
    });
  };

  return (
    <div>
      <h2>Recipe Management</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!isConnected && <p>Connecting to server...</p>}
      <div>
        <h3>Create/Update Recipe</h3>
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Menu Item ID"
          value={formData.menuItemId}
          onChange={(e) => setFormData({ ...formData, menuItemId: e.target.value })}
        />
        <textarea
          placeholder="Preparation Instructions"
          value={formData.preparationInstructions}
          onChange={(e) =>
            setFormData({ ...formData, preparationInstructions: e.target.value })
          }
        />
        <button onClick={handleCreate} disabled={!isConnected}>
          Create Recipe
        </button>
      </div>
      <div>
        <h3>Scale Recipe</h3>
        <input
          type="text"
          placeholder="Recipe ID"
          value={scaleData.id}
          onChange={(e) => setScaleData({ ...scaleData, id: e.target.value })}
        />
        <input
          type="number"
          placeholder="Scale Factor"
          value={scaleData.scale}
          onChange={(e) =>
            setScaleData({ ...scaleData, scale: Number(e.target.value) })
          }
        />
        <button onClick={handleScale} disabled={!isConnected}>
          Scale Recipe
        </button>
      </div>
      <div>
        <h3>Recipes</h3>
        <ul>
          {recipes.map((item) => (
            <li key={item._id}>
              {item.name} - Version {item.version} (
              {item.isActive ? 'Active' : 'Inactive'})
              <button onClick={() => handleUpdate(item._id)} disabled={!isConnected}>
                Update
              </button>
              <button onClick={() => handleDelete(item._id)} disabled={!isConnected}>
                Delete
              </button>
              <button
                onClick={() => checkAvailability(item._id)}
                disabled={!isConnected}
              >
                Check Availability
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RecipeManagement;
