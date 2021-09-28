# -*- coding: utf-8 -*-
"""
Created on Thu Sep 23 15:21:48 2021

@author: Usuario
"""
from clases import ingrediente
from clases import side
from clases import comida
import pickle as pkl
import pandas as pd
import csv
class Todo:
    def __init__(self,usuario):
        self.usuario = usuario
        self.comidas = {}
        self.guarniciones = {}
        self.ingredientes = {}
        self.ultimasComidas = []
        self.ultimasGuarniciones = []
    def guardar(self):
        with open(f'{self.usuario}.pkl','wb') as file:
            pkl.dump(self,file)
    def cargarComidas(self,dataC):
        data = pd.read_csv(dataC,sep=';')
        if data.columns[0] != 'comidas':
            data = pd.read_csv(dataC,sep = ',')
        try:
            mensaje = ''
            for i,listaGuar in enumerate(data['guarniciones']):
                listaGuar = listaGuar.splitlines()
                listaGuar = csv.reader(listaGuar)
                listaGuar = list(listaGuar)[0]
                data['guarniciones'][i] = listaGuar
            for i,listaIngr in enumerate(data['ingredientes']):
                listaIngr = listaIngr.splitlines()
                listaIngr = csv.reader(listaIngr)
                listaIngr = list(listaIngr)[0]
                data['ingredientes'][i] = listaIngr            
            for i,food in enumerate(data['comidas']):
                if food not in self.comidas:
                    self.comidas[food] = comida(food)
                try:
                    self.comidas[food].salud = data['salud'][i]
                    self.comidas[food].costo = data['costo'][i]
                    self.comidas[food].rico = data['rico'][i]
                    
                except KeyError:
                    mensaje = 'algun elemento subido por default(salud,cost, etc)'
                for guarnicion in data['guarniciones'][i]:
                    if guarnicion not in self.guarniciones:
                        guar = side(guarnicion)
                    else:
                        guar = self.guarniciones[guarnicion]
                    self.comidas[food].agregarGuarnicion(guar)
                    self.guarniciones[guar.nombre] = guar
                for ingr in data['ingredientes'][i]:
                    if ingr not in self.ingredientes:
                        ingre = ingrediente(ingr)
                    else:
                        ingre = self.ingredientes[ingr]
                    self.comidas[food].agregarIngrediente(ingre)
                    self.ingredientes[ingre.nombre] = ingre
            self.guardar()
            if mensaje:
                print(mensaje)
        except KeyError:
            print('Probablemente hay algo mal con el formato csv. Debe tener las columnas:comidas,guarniciones,ingredientes...')
    def cargarGuarniciones(self,dataG):
        data = pd.read_csv(dataG, sep = ';')
        if data.columns[0] != 'guarniciones':
            data = pd.read_csv(dataG, sep = ',')
        for i,guar in enumerate(data['guarniciones']):
            mensaje = ''
            if guar not in self.guarniciones:
                guarnicion = side(guar)
                self.guarniciones[guar] = guarnicion
                try:
                    self.guarniciones[guar].salud = data['salud'][i]
                    self.guarniciones[guar].costo = data['costo'][i]
                    self.guarniciones[guar].rico  = data['rico'][i]
                    self.guarniciones[guar].tiempo= data['tiempo'][i]
                except KeyError:   
                    mensaje = 'algun elemento subido por default(salud,cost, etc)'
                for ingr in data['ingredientes'][i]: 
                    if ingr not in self.ingredientes[ingr]:
                        ingre = ingrediente(ingr)
                    else:
                        ingre = self.ingredientes[ingr]
                    self.guarniciones[guar].agregarIngrediente(ingre)
                    self.ingredientes[ingre.nombre] = ingre
        self.guardar()
        if mensaje:
            print(mensaje)
            
            
        


            
        