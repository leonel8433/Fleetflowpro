
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type ReportType = 'trips' | 'consumption' | 'fines' | 'management';
type DetailType = 'maintenance' | 'operational' | 'total';

const ReportsPage: React.FC = () => {
  const { vehicles, drivers, completedTrips, fines, maintenanceRecords, currentUser } = useFleet();
  const [activeReport, setActiveReport] = useState<ReportType>('trips');
  const [detailModal, setDetailModal] = useState<DetailType | null>(null);
  
  const isAdmin = currentUser?.username === 'admin';

  // Filtros de Data
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Lógica de filtragem de dados
  const filteredTrips = useMemo(() => {
    return completedTrips.filter(t => {
      const tripDate = t.startTime.split('T')[0];
      const matchesDate = tripDate >= startDate && tripDate <= endDate;
      const matchesUser = isAdmin ? true : t.driverId === currentUser?.id;
      return matchesDate && matchesUser;
    });
  }, [completedTrips, startDate, endDate, isAdmin, currentUser]);

  const filteredFines = useMemo(() => {
    return fines.filter(f => {
      const matchesDate = f.date >= startDate && f.date <= endDate;
      const matchesUser = isAdmin ? true : f.driverId === currentUser?.id;
      return matchesDate && matchesUser;
    });
  }, [fines, startDate, endDate, isAdmin, currentUser]);

  const filteredMaintenance = useMemo(() => {
    return maintenanceRecords.filter(m => m.date >= startDate && m.date <= endDate);
  }, [maintenanceRecords, startDate, endDate]);

  // Dados para Relatório de Volume de Viagens
  const tripChartData = useMemo(() => {
    if (isAdmin) {
      return drivers.map(d => {
        const count = filteredTrips.filter(t => t.driverId === d.id).length;
        return { name: d.name.split(' ')[0], viagens: count };
      }).filter(s => s.viagens > 0);
    } else {
      const dailyMap: Record<string, number> = {};
      filteredTrips.forEach(t => {
        const day = new Date(t.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      });
      return Object.entries(dailyMap).map(([name, viagens]) => ({ name, viagens }));
    }
  }, [drivers, filteredTrips, isAdmin]);

  // Resumo Gerencial e Custos
  const managementSummary = useMemo(() => {
    const totalDist = filteredTrips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalMaintCost = filteredMaintenance.reduce((sum, m) => sum + m.cost, 0);
    const totalFineCost = filteredFines.reduce((sum, f) => sum + f.value, 0);
    const totalTripFuel = filteredTrips.reduce((sum, t) => sum + (t.fuelExpense || 0), 0);
    const totalTripOther = filteredTrips.reduce((sum, t) => sum + (t.otherExpense || 0), 0);
    
    return { totalDist, totalMaintCost, totalFineCost, totalTripFuel, totalTripOther };
  }, [filteredTrips, filteredMaintenance, filteredFines]);

  // Dados para o Gráfico de Consumo (Pizza)
  const consumptionPieData = useMemo(() => [
    { name: 'Combustível', value: managementSummary.totalTripFuel },
    { name: 'Outras Despesas', value: managementSummary.totalTripOther }
  ].filter(d => d.value > 0), [managementSummary]);

  const COLORS = ['#10b981', '#6366f1'];

  // Lógica de Detalhamento Analítico para o Modal
  const detailedData = useMemo(() => {
    const items: any[] = [];

    if (detailModal === 'maintenance' || detailModal === 'total') {
      filteredMaintenance.forEach(m => {
        const v = vehicles.find(vh => vh.id === m.vehicleId);
        items.push({
          date: m.date,
          vehicle: v ? `${v.plate} - ${v.model}` : 'N/A',
          category: 'Manutenção',
          description: m.serviceType,
          value: m.cost
        });
      });
    }

    if (detailModal === 'operational' || detailModal === 'total') {
      filteredTrips.forEach(t => {
        const v = vehicles.find(vh => vh.id === t.vehicleId);
        if (t.fuelExpense && t.fuelExpense > 0) {
          items.push({
            date: t.startTime.split('T')[0],
            vehicle: v ? `${v.plate} - ${v.model}` : 'N/A',
            category: 'Combustível (Viagem)',
            description: t.destination,
            value: t.fuelExpense
          });
        }
        if (t.otherExpense && t.otherExpense > 0) {
          items.push({
            date: t.startTime.split('T')[0],
            vehicle: v ? `${v.plate} - ${v.model}` : 'N/A',
            category: 'Extras/Pedágio (Viagem)',
            description: t.destination,
            value: t.otherExpense
          });
        }
      });
    }

    if (detailModal === 'total') {
      filteredFines.forEach(f => {
        const v = vehicles.find(vh => vh.id === f.vehicleId);
        items.push({
          date: f.date,
          vehicle: v ? `${v.plate} - ${v.model}` : 'N/A',
          category: 'Multa',
          description: f.description,
          value: f.value
        });
      });
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailModal, filteredMaintenance, filteredTrips, filteredFines, vehicles]);

  // Lógica de Exportação CSV
  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = `relatorio_${activeReport}_${startDate}_a_${endDate}.csv`;

    const downloadCSV = (content: string, name: string) => {
      const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", name);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (activeReport === 'trips') {
      const headers = "ID;Data;Motorista;Veiculo;Origem;Destino;Cidade;KM_Inicial;KM_Final;Distancia_KM\n";
      const rows = filteredTrips.map(t => {
        const d = drivers.find(drv => drv.id === t.driverId)?.name || 'N/A';
        const v = vehicles.find(vh => vh.id === t.vehicleId)?.plate || 'N/A';
        return `${t.id};${new Date(t.startTime).toLocaleDateString()};${d};${v};${t.origin};${t.destination};${t.city};${t.startKm};${(t.startKm + (t.distance || 0))};${(t.distance || 0).toFixed(2)}`;
      }).join("\n");
      csvContent = headers + rows;
    } else if (activeReport === 'consumption') {
      const headers = "ID;Data;Veiculo;KM_Rodados;Combustivel_RS;Outros_RS;Total_RS;Notas\n";
      const rows = filteredTrips.map(t => {
        const v = vehicles.find(vh => vh.id === t.vehicleId)?.plate || 'N/A';
        const fuel = t.fuelExpense || 0;
        const other = t.otherExpense || 0;
        return `${t.id};${new Date(t.startTime).toLocaleDateString()};${v};${(t.distance || 0).toFixed(2)};${fuel.toFixed(2)};${other.toFixed(2)};${(fuel + other).toFixed(2)};${t.expenseNotes || ''}`;
      }).join("\n");
      csvContent = headers + rows;
    } else if (activeReport === 'fines') {
      const headers = "ID;Data;Motorista;Veiculo;Valor_RS;Pontos;Descricao\n";
      const rows = filteredFines.map(f => {
        const d = drivers.find(drv => drv.id === f.driverId)?.name || 'N/A';
        const v = vehicles.find(vh => vh.id === f.vehicleId)?.plate || 'N/A';
        return `${f.id};${new Date(f.date).toLocaleDateString()};${d};${v};${f.value.toFixed(2)};${f.points};${f.description}`;
      }).join("\n");
      csvContent = headers + rows;
    } else if (activeReport === 'management' && isAdmin) {
      const headers = "ID;Data;Veiculo;Servico;Custo_RS;KM_Saida;KM_Retorno;Notas\n";
      const rows = filteredMaintenance.map(m => {
        const v = vehicles.find(vh => vh.id === m.vehicleId)?.plate || 'N/A';
        return `${m.id};${new Date(m.date).toLocaleDateString()};${v};${m.serviceType};${m.cost.toFixed(2)};${m.km};${m.km};${m.notes}`;
      }).join("\n");
      csvContent = headers + rows;
    }

    if (csvContent) {
      downloadCSV(csvContent, fileName);
    } else {
      alert("Nenhum dado disponível para exportação no período selecionado.");
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Indicadores de Performance</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Análise Gerencial da Frota' : 'Meus Resultados Operacionais'}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-write text-slate-400 uppercase mb-1">Início</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-write text-slate-400 uppercase mb-1">Fim</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            className="w-full md:w-auto px-6 py-4 bg-slate-900 text-white rounded-2xl font-write uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 active:scale-95"
          >
            <i className="fas fa-file-csv text-sm"></i>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'trips', label: 'Viagens', icon: 'fa-route', adminOnly: false },
          { id: 'consumption', label: 'Consumo', icon: 'fa-gas-pump', adminOnly: false },
          { id: 'fines', label: 'Multas', icon: 'fa-gavel', adminOnly: false },
          { id: 'management', label: 'Gerencial', icon: 'fa-briefcase', adminOnly: true },
        ].filter(t => !t.adminOnly || isAdmin).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all ${
              activeReport === tab.id 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-500">
        {activeReport === 'trips' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">
                {isAdmin ? 'Volume de Viagens por Condutor' : 'Viagens Realizadas no Período'}
              </h3>
              <div className="h-80 w-full">
                {tripChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tripChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="viagens" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 italic font-medium">Nenhum dado no período selecionado</div>
                )}
              </div>
            </div>
            <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
              <div>
                <i className="fas fa-info-circle text-blue-400 text-2xl mb-4"></i>
                <h4 className="text-lg font-write uppercase mb-4">Sumário</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total de Viagens</p>
                    <p className="text-4xl font-write tracking-tighter">{filteredTrips.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">KM Rodados</p>
                    <p className="text-3xl font-write tracking-tighter">{managementSummary.totalDist.toLocaleString()} km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'consumption' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Combustível</p>
                <p className="text-3xl font-write text-emerald-600">{formatCurrency(managementSummary.totalTripFuel)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Outras Despesas</p>
                <p className="text-3xl font-write text-indigo-600">{formatCurrency(managementSummary.totalTripOther)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Total</p>
                <p className="text-3xl font-write text-slate-800">{formatCurrency(managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Médio / KM</p>
                <p className="text-3xl font-write text-blue-600">
                  {managementSummary.totalDist > 0 ? formatCurrency((managementSummary.totalTripFuel + managementSummary.totalTripOther) / managementSummary.totalDist) : 'R$ 0,00'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-96">
                <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Distribuição de Despesas</h3>
                {consumptionPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={consumptionPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {consumptionPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 italic">Sem dados financeiros no período.</div>
                )}
              </div>
              <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-center shadow-xl">
                 <h4 className="text-lg font-write uppercase mb-4 text-blue-400">Dica Gerencial</h4>
                 <p className="text-sm leading-relaxed opacity-80">
                   As despesas de combustível representam {(managementSummary.totalTripFuel + managementSummary.totalTripOther) > 0 ? ((managementSummary.totalTripFuel / (managementSummary.totalTripFuel + managementSummary.totalTripOther)) * 100).toFixed(1) : 0}% do seu custo operacional neste período.
                   Monitore o KM rodado para otimizar as rotas.
                 </p>
              </div>
            </div>
          </div>
        )}
        
        {activeReport === 'fines' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-8 text-center">
             <i className="fas fa-gavel text-4xl text-slate-200 mb-4"></i>
             <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-2">Multas e Infrações</h3>
             <p className="text-4xl font-write text-red-600 mb-2">{filteredFines.length}</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multas acumuladas no período selecionado ({formatCurrency(managementSummary.totalFineCost)})</p>
          </div>
        )}

        {activeReport === 'management' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => setDetailModal('maintenance')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-left hover:border-blue-300 transition-all group"
            >
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Manutenção Preventiva/Corretiva</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-blue-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-slate-800">{formatCurrency(managementSummary.totalMaintCost)}</p>
            </button>
            <button 
              onClick={() => setDetailModal('operational')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-left hover:border-emerald-300 transition-all group"
            >
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Despesas Operacionais (Viagens)</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-emerald-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-emerald-600">{formatCurrency(managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
            </button>
            <button 
              onClick={() => setDetailModal('total')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-left hover:border-red-300 transition-all group"
            >
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Total Geral de Despesas</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-red-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-red-600">{formatCurrency(managementSummary.totalMaintCost + managementSummary.totalFineCost + managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalhamento Analítico */}
      {detailModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">
                  {detailModal === 'maintenance' ? 'Detalhamento de Manutenção' : 
                   detailModal === 'operational' ? 'Detalhamento de Despesas de Viagem' : 
                   'Consolidado Geral de Despesas'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Período: {new Date(startDate + 'T12:00:00').toLocaleDateString()} a {new Date(endDate + 'T12:00:00').toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => setDetailModal(null)}
                className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center shadow-inner"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50">
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100 rounded-tl-2xl">Data</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Veículo</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Categoria</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Descrição / Local</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100 rounded-tr-2xl text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {detailedData.length > 0 ? detailedData.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-800 whitespace-nowrap">
                          {new Date(item.date + 'T12:00:00').toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-600">
                          {item.vehicle}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-write uppercase border ${
                            item.category === 'Manutenção' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            item.category === 'Multa' ? 'bg-red-50 text-red-600 border-red-100' :
                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-medium text-slate-500 truncate max-w-[200px]">
                          {item.description}
                        </td>
                        <td className="px-6 py-4 text-xs font-write text-slate-900 text-right whitespace-nowrap">
                          {formatCurrency(item.value)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-300 italic font-medium">Nenhuma despesa encontrada para este critério.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Total do Filtro: <span className="text-slate-800 ml-2">{detailedData.length} registros</span>
              </p>
              <div className="text-right">
                 <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Montante Consolidado</p>
                 <p className="text-2xl font-write text-slate-900">
                   {formatCurrency(detailedData.reduce((sum, item) => sum + item.value, 0))}
                 </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
