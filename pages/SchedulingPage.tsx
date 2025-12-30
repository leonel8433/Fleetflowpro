
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, Vehicle } from '../types';
import { checkSPRodizio, getRodizioDayLabel } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, currentUser } = useFleet();
  const [showForm, setShowForm] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newSchedule, setNewSchedule] = useState({
    driverId: '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    waypoints: [] as string[],
    city: '',
    state: '',
    zipCode: '',
    notes: ''
  });

  const isAdmin = currentUser?.username === 'admin';

  const visibleSchedules = useMemo(() => {
    if (isAdmin) return scheduledTrips;
    return scheduledTrips.filter(t => t.driverId === currentUser?.id);
  }, [scheduledTrips, isAdmin, currentUser]);

  const selectedVehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
  
  const isRestricted = useMemo(() => {
    if (!selectedVehicle || !newSchedule.scheduledDate) return false;
    const [year, month, day] = newSchedule.scheduledDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return checkSPRodizio(selectedVehicle.plate, dateObj);
  }, [selectedVehicle, newSchedule.scheduledDate]);

  const handleEdit = (trip: ScheduledTrip) => {
    setNewSchedule({
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      scheduledDate: trip.scheduledDate,
      origin: trip.origin || '',
      destination: trip.destination,
      waypoints: trip.waypoints || [],
      city: trip.city || '',
      state: trip.state || '',
      zipCode: trip.zipCode || '',
      notes: trip.notes || ''
    });
    setEditingId(trip.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddWaypoint = () => {
    setNewSchedule(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const handleUpdateWaypoint = (index: number, value: string) => {
    const updated = [...newSchedule.waypoints];
    updated[index] = value;
    setNewSchedule(prev => ({ ...prev, waypoints: updated }));
  };

  const handleRemoveWaypoint = (index: number) => {
    setNewSchedule(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
  };

  const handleGetCurrentLocation = () => {
    setLoadingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setNewSchedule(prev => ({ ...prev, origin: `${latitude},${longitude}` }));
          setLoadingLocation(false);
        },
        (error) => {
          alert("Não foi possível obter sua localização atual.");
          setLoadingLocation(false);
        }
      );
    } else {
      alert("Geolocalização não suportada.");
      setLoadingLocation(false);
    }
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination) return;

    if (editingId) {
      updateScheduledTrip(editingId, {
        ...newSchedule,
        waypoints: newSchedule.waypoints.filter(w => w.trim() !== '')
      });
      setEditingId(null);
      alert('Agendamento atualizado com sucesso!');
    } else {
      const trip: ScheduledTrip = {
        id: Math.random().toString(36).substr(2, 9),
        driverId: newSchedule.driverId,
        vehicleId: newSchedule.vehicleId,
        scheduledDate: newSchedule.scheduledDate,
        origin: newSchedule.origin,
        destination: newSchedule.destination,
        waypoints: newSchedule.waypoints.filter(w => w.trim() !== ''),
        city: newSchedule.city,
        state: newSchedule.state,
        zipCode: newSchedule.zipCode,
        notes: newSchedule.notes
      };
      addScheduledTrip(trip);
      alert('Viagem agendada com sucesso!');
    }

    setNewSchedule({
      driverId: '',
      vehicleId: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      origin: '',
      destination: '',
      waypoints: [],
      city: '',
      state: '',
      zipCode: '',
      notes: ''
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda de Viagens</h2>
          {!isAdmin && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Meus compromissos agendados</p>}
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) setEditingId(null);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-calendar-plus'}`}></i>
            {showForm ? 'Cancelar' : 'Agendar Viagem'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">
            {editingId ? 'Alterar Detalhes da Viagem' : 'Novo Agendamento'}
          </h3>
          <form onSubmit={handleAddSchedule} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motorista</label>
                <select
                  required
                  value={newSchedule.driverId}
                  onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950"
                >
                  <option value="">Selecione...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Veículo</label>
                <select
                  required
                  value={newSchedule.vehicleId}
                  onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })}
                  className={`w-full p-3 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950 transition-all ${isRestricted ? 'border-amber-400' : 'border-slate-200'}`}
                >
                  <option value="">Selecione...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Data</label>
                <input
                  required
                  type="date"
                  value={newSchedule.scheduledDate}
                  onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })}
                  className={`w-full p-3 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950 transition-all ${isRestricted ? 'border-amber-400' : 'border-slate-200'}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Origem</label>
                <div className="flex gap-2">
                  <input
                    placeholder="Local de saída"
                    value={newSchedule.origin}
                    onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })}
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950"
                  />
                  <button type="button" onClick={handleGetCurrentLocation} className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-location-crosshairs"></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Destino Final</label>
                <input
                  required
                  placeholder="Local de chegada"
                  value={newSchedule.destination}
                  onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950"
                />
              </div>
            </div>

            {/* Waypoints Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 uppercase">Paradas Intermediárias</label>
                <button 
                  type="button" 
                  onClick={handleAddWaypoint}
                  className="text-[10px] font-write text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-800"
                >
                  <i className="fas fa-plus-circle"></i> Adicionar Parada
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {newSchedule.waypoints.map((wp, idx) => (
                  <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center justify-center w-8 text-slate-300 font-bold">{idx + 1}</div>
                    <input
                      placeholder={`Endereço da parada ${idx + 1}`}
                      value={wp}
                      onChange={(e) => handleUpdateWaypoint(idx, e.target.value)}
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-950"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveWaypoint(idx)}
                      className="w-11 h-11 text-red-300 hover:text-red-500 transition-colors"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input
                placeholder="Cidade"
                value={newSchedule.city}
                onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
              />
              <input
                placeholder="UF"
                maxLength={2}
                value={newSchedule.state}
                onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value.toUpperCase() })}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
              />
              <input
                placeholder="CEP"
                value={newSchedule.zipCode}
                onChange={(e) => setNewSchedule({ ...newSchedule, zipCode: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
              />
            </div>

            <div className="flex justify-end gap-3">
              {editingId && (
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-3 font-bold text-slate-400 uppercase text-xs">Cancelar</button>
              )}
              <button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all">
                {editingId ? 'Salvar Alterações' : 'Agendar Viagem'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleSchedules.length > 0 ? (
          visibleSchedules.map(trip => {
            const vehicle = vehicles.find(v => v.id === trip.vehicleId);
            const driver = drivers.find(d => d.id === trip.driverId);
            const tripDate = new Date(trip.scheduledDate + 'T00:00:00');
            const restricted = vehicle && checkSPRodizio(vehicle.plate, tripDate);

            return (
              <div key={trip.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-all relative overflow-hidden">
                {restricted && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>}
                
                <div className="w-full md:w-32 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
                  <span className="text-2xl font-write text-slate-800">{tripDate.getDate()}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Motorista</p>
                    <p className="font-bold text-slate-800">{driver?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Veículo</p>
                    <p className="font-bold text-indigo-600">{vehicle?.plate} {restricted && '⚠️'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Rota</p>
                    <p className="font-bold text-slate-800 truncate">{trip.destination}</p>
                    {trip.waypoints && trip.waypoints.length > 0 && (
                      <p className="text-[9px] text-indigo-500 font-bold uppercase mt-1">
                        <i className="fas fa-map-signs mr-1"></i> {trip.waypoints.length} Parada(s) intermediária(s)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const origin = trip.origin ? encodeURIComponent(trip.origin) : '';
                      const dest = encodeURIComponent(`${trip.destination}, ${trip.city}`);
                      const wp = trip.waypoints && trip.waypoints.length > 0 
                        ? `&waypoints=${trip.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
                        : '';
                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wp}&travelmode=driving`, '_blank');
                    }}
                    className="w-10 h-10 bg-slate-50 text-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-50 border border-indigo-100 transition-all"
                    title="Ver Rota"
                  >
                    <i className="fas fa-route"></i>
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => handleEdit(trip)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-blue-600 hover:bg-blue-50">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => deleteScheduledTrip(trip.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <p className="text-slate-400 font-medium italic">Nenhum agendamento encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
