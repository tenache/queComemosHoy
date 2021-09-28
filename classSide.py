# -*- coding: utf-8 -*-
"""
Created on Sat Sep 25 20:19:57 2021

@author: Usuario
"""
from classComida import comida
from classIngredientes import ingrediente
class side:
    def __init__(self,nombre):
        self.nombre = nombre
        self.reciente = 1
        self.costo = 2
        self.salud = 2
        self.rico = 2
        self.tiempo = 2
        self.ingredientes = []
        self.comidas = []
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
                newIngr.guarniciones.append(self)
            else:
                newIngr = ingr
                self.ingredientes.append(newIngr)
                newIngr.guarniciones.append(self)      
    def agregarComida(self,listaDecomidas):
        if type(listaDecomidas) != list:
            foods = []
            foods.append(listaDecomidas)
        else:
            foods = listaDecomidas
        for food in foods:
            if type(food)== str:
                newFood= comida(food)
                newFood.guarniciones.append(self)
                self.comidas.append(newFood)
            elif isinstance(food,comida):
                newFood = food
                newFood.guarniciones.append(self)
                self.comidas.append(newFood)  
            else:
                print('Type Error. No se agrego la guarnicion' + str(food))
    def calcularPeso(self):
        self.peso = self.reciente-self.costo+self.salud+self.rico-self.tiempo
        for ingr in self.ingredientes:
            self.peso += ingr.reciente
    def guardar(self,usuario):
        usuario.guarniciones[self.nombre]=self
        usuario.guardar()