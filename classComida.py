# -*- coding: utf-8 -*-
"""
Created on Sat Sep 25 20:19:23 2021

@author: Usuario
"""
from classSide import side
from classIngredientes import ingrediente
class comida:
    def __init__(self, nombre ):
        self.nombre = nombre
        self.reciente = 1
        self.costo = 2
        self.salud = 2
        self.rico = 2
        self.tiempo = 2
        self.ingredientes = []
        self.guarniciones = []
    def agregarGuarnicion(self,listaDeGuarniciones):
        if type(listaDeGuarniciones) != list:
            guarniciones = []
            guarniciones.append(listaDeGuarniciones)
        else:
            guarniciones = listaDeGuarniciones
        for guarnicion in guarniciones:
            if type(guarnicion)== str:
                newSide= side(guarnicion)
                newSide.comidas.append(self)
                self.guarniciones.append(newSide)
            elif isinstance(guarnicion,side):
                newSide = guarnicion
                newSide.comidas.append(self)
                self.guarniciones.append(newSide)                
            else:
                print('Type Error. No se agrego la guarnicion' + str(guarnicion))
    def agregarIngrediente(self,listaDeIngredientes):
        #if type(listaDeIngredientes) != list:
        if type (listaDeIngredientes)  != list:
            todosIngredientes = []
            todosIngredientes.append(listaDeIngredientes)
        else:
            todosIngredientes = listaDeIngredientes
        for ingr in todosIngredientes:
            if type(ingr) == str:
                newIngr= ingrediente(ingr)
                self.ingredientes.append(newIngr)
                newIngr.comidas.append(self)
            else:
                newIngr = ingr
                self.ingredientes.append(newIngr)
                newIngr.comidas.append(self)
    def calcularPeso(self):
        self.peso = self.reciente-self.costo+self.salud+self.rico-self.tiempo
        for ingr in self.ingredientes:
            self.peso += ingr.reciente
    def guardar(self,usuario):
        usuario.guarniciones[self.nombre]=self
        for ingr in self.ingredientes:
            if ingr.name not in usuario.ingredientes:
                usuario.ingredientes[ingr.name] = ingr
        usuario.guardar()
